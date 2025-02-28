import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import type { Psbt, FeeEstimates } from 'bitcoindevkit';
import { Address, Amount } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  SendFormContext,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  SendFlowRepository,
  SnapClient,
  TransactionRequest,
  ReviewTransactionContext,
  AssetRatesClient,
  ExchangeRates,
} from '../entities';
import {
  ReviewTransactionEvent,
  CurrencyUnit,
  SendFormEvent,
} from '../entities';
import type { ILogger } from '../infra/logger';
import { SendFlowUseCases } from './SendFlowUseCases';

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('bitcoindevkit', () => {
  return {
    Address: {
      from_string: jest.fn(),
    },
    Amount: {
      from_btc: jest.fn(),
    },
  };
});

jest.mock('../infra/logger', () => {
  return { logger: mock<ILogger>() };
});

describe('SendFlowUseCases', () => {
  let useCases: SendFlowUseCases;

  const mockSnapClient = mock<SnapClient>();
  const mockAccountRepository = mock<BitcoinAccountRepository>();
  const mockSendFlowRepository = mock<SendFlowRepository>();
  const mockChain = mock<BlockchainClient>();
  const mockRatesClient = mock<AssetRatesClient>();
  const targetBlocksConfirmation = 3;
  const fallbackFeeRate = 5.0;
  const ratesRefreshInterval = 'PT30S';
  const mockAccount = mock<BitcoinAccount>({
    network: 'bitcoin',
    buildTx: jest.fn(),
    sign: jest.fn(),
  });
  const mockTxRequest = mock<TransactionRequest>();

  beforeEach(() => {
    useCases = new SendFlowUseCases(
      mockSnapClient,
      mockAccountRepository,
      mockSendFlowRepository,
      mockChain,
      mockRatesClient,
      targetBlocksConfirmation,
      fallbackFeeRate,
      ratesRefreshInterval,
    );
  });

  describe('displayForm', () => {
    it('throws error if account not found', async () => {
      mockAccountRepository.get.mockResolvedValue(null);
      await expect(useCases.display('non-existent-account')).rejects.toThrow(
        'Account not found',
      );
    });

    it('throws UserRejectedRequestError if displayInterface returns null', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockSendFlowRepository.insertForm.mockResolvedValue('interface-id');
      mockSnapClient.displayInterface.mockResolvedValue(null);

      await expect(useCases.display('account-id')).rejects.toThrow(
        UserRejectedRequestError,
      );
    });

    it('displays Send form and returns transaction request when resolved', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockSendFlowRepository.insertForm.mockResolvedValue('interface-id');
      mockSnapClient.displayInterface.mockResolvedValue(mockTxRequest);

      const result = await useCases.display('account-id');

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockSendFlowRepository.insertForm).toHaveBeenCalledWith(
        mockAccount,
        fallbackFeeRate,
      );
      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalledWith(
        'PT1S',
        SendFormEvent.RefreshRates,
        'interface-id',
      );
      expect(mockSnapClient.displayInterface).toHaveBeenCalledWith(
        'interface-id',
      );
      expect(result).toStrictEqual(mockTxRequest);
    });
  });

  describe('onFormInput', () => {
    const mockTxBuilder = {
      addRecipient: jest.fn(),
      feeRate: jest.fn(),
      drainTo: jest.fn(),
      drainWallet: jest.fn(),
      finish: jest.fn(),
      unspendable: jest.fn(),
    };
    const mockPsbt = mock<Psbt>();

    const mockContext: SendFormContext = {
      account: { id: 'account-id', address: 'myAddress' },
      amount: '1000',
      balance: '20000',
      currency: CurrencyUnit.Bitcoin,
      drain: false,
      recipient: 'recipientAddress',
      errors: {
        recipient: 'invalid recipient',
        tx: 'errors on tx',
        amount: 'invalid amount',
      },
      feeRate: 2.4,
      network: 'bitcoin',
      fee: '10',
      exchangeRate: {
        currency: 'USD',
        conversionRate: 100000,
        conversionDate: 2025,
      },
    };

    beforeEach(() => {
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.addRecipient.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainTo.mockReturnThis();
      mockTxBuilder.drainWallet.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockPsbt);
      mockTxBuilder.unspendable.mockReturnThis();

      mockSnapClient.getInterfaceContext.mockResolvedValue(mockContext);
    });

    it('throws error unrecognized event', async () => {
      await expect(
        useCases.onFormInput('interface-id', 'randomEvent' as SendFormEvent),
      ).rejects.toThrow('Unrecognized event');
    });

    it('resolves to null on Cancel', async () => {
      await useCases.onFormInput('interface-id', SendFormEvent.Cancel);
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        null,
      );
    });

    it('clears state on ClearRecipient', async () => {
      const expectedContext = {
        ...mockContext,
        recipient: undefined,
        fee: undefined,
        errors: {
          ...mockContext.errors,
          tx: undefined,
          recipient: undefined,
        },
      };

      await useCases.onFormInput('interface-id', SendFormEvent.ClearRecipient);
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });

    it('throws error on Review if amount, recipient or fee are not defined', async () => {
      mockSnapClient.getInterfaceContext.mockResolvedValueOnce({
        ...mockContext,
        recipient: undefined,
      });
      await expect(
        useCases.onFormInput('interface-id', SendFormEvent.Confirm),
      ).rejects.toThrow('Inconsistent Send form context');

      mockSnapClient.getInterfaceContext.mockResolvedValueOnce({
        ...mockContext,
        amount: undefined,
      });
      await expect(
        useCases.onFormInput('interface-id', SendFormEvent.Confirm),
      ).rejects.toThrow('Inconsistent Send form context');

      mockSnapClient.getInterfaceContext.mockResolvedValueOnce({
        ...mockContext,
        fee: undefined,
      });
      await expect(
        useCases.onFormInput('interface-id', SendFormEvent.Confirm),
      ).rejects.toThrow('Inconsistent Send form context');
    });

    it('updates interface to the transaction review on Confirm', async () => {
      const expectedReviewContext: ReviewTransactionContext = {
        from: mockContext.account.address,
        network: mockContext.network,
        amount: '1000',
        recipient: 'recipientAddress',
        feeRate: mockContext.feeRate,
        exchangeRate: mockContext.exchangeRate,
        currency: mockContext.currency,
        fee: '10',
        sendForm: mockContext,
      };

      await useCases.onFormInput('interface-id', SendFormEvent.Confirm);
      expect(mockSendFlowRepository.updateReview).toHaveBeenCalledWith(
        'interface-id',
        expectedReviewContext,
      );
    });

    it('clears state and set drain to true on SetMax', async () => {
      // avoid computing the fee in this test
      const testContext = {
        ...mockContext,
        recipient: undefined,
      };
      mockSnapClient.getInterfaceContext.mockResolvedValueOnce(testContext);

      const expectedContext = {
        ...testContext,
        drain: true,
        amount: mockContext.balance,
        fee: undefined,
        errors: {
          ...mockContext.errors,
          tx: undefined,
          amount: undefined,
        },
      };

      await useCases.onFormInput('interface-id', SendFormEvent.SetMax);
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });

    it('sets recipient from state on Recipient', async () => {
      (Address.from_string as jest.Mock).mockReturnValue({
        toString: () => 'newAddressValidated',
      });

      // avoid computing the fee in this test
      const testContext = {
        ...mockContext,
        amount: undefined,
      };
      mockSnapClient.getInterfaceContext.mockResolvedValueOnce(testContext);

      mockSendFlowRepository.getState.mockResolvedValue({
        recipient: 'newAddress',
        amount: '',
      });
      const expectedContext = {
        ...testContext,
        recipient: 'newAddressValidated',
        errors: {
          ...mockContext.errors,
          tx: undefined,
          recipient: undefined,
        },
      };

      await useCases.onFormInput('interface-id', SendFormEvent.Recipient);

      expect(mockSendFlowRepository.getState).toHaveBeenCalledWith(
        'interface-id',
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });

    it('sets amount from state on Amount', async () => {
      (Amount.from_btc as jest.Mock).mockReturnValue({
        to_sat: () => BigInt('1111'), // Use different amount than state to verify that we get the result from the toString of the bigint
      });

      const testContext = {
        ...mockContext,
        recipient: undefined, // avoid computing the fee in this test
      };
      mockSnapClient.getInterfaceContext.mockResolvedValueOnce(testContext);

      mockSendFlowRepository.getState.mockResolvedValue({
        recipient: '',
        amount: '21000',
      });
      const expectedContext = {
        ...testContext,
        drain: undefined,
        fee: undefined,
        amount: '1111',
        errors: {
          ...mockContext.errors,
          tx: undefined,
          amount: undefined,
        },
      };

      await useCases.onFormInput('interface-id', SendFormEvent.Amount);

      expect(mockSendFlowRepository.getState).toHaveBeenCalledWith(
        'interface-id',
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });

    it('computes the fee when amount and recipient are filled: drain', async () => {
      mockPsbt.fee.mockReturnValue({
        to_sat: () => BigInt(10),
      } as unknown as Amount);
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockAccountRepository.getFrozenUTXOs.mockResolvedValue(['txid:vout']);

      const expectedContext = {
        ...mockContext,
        drain: true,
        fee: '10',
        amount: String(20000 - 10),
        errors: expect.anything(),
      };

      await useCases.onFormInput('interface-id', SendFormEvent.SetMax);

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockAccountRepository.getFrozenUTXOs).toHaveBeenCalledWith(
        'account-id',
      );
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith(['txid:vout']);
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(
        expectedContext.feeRate,
      );
      expect(mockTxBuilder.drainWallet).toHaveBeenCalled();
      expect(mockTxBuilder.drainTo).toHaveBeenCalledWith('recipientAddress');
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });

    it('computes the fee when amount and recipient are filled', async () => {
      (Address.from_string as jest.Mock).mockReturnValue({
        toString: () => 'newAddressValidated',
      });
      mockPsbt.fee.mockReturnValue({
        to_sat: () => BigInt(10),
      } as unknown as Amount);
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockAccountRepository.getFrozenUTXOs.mockResolvedValue([]);
      mockSendFlowRepository.getState.mockResolvedValue({
        recipient: 'newAddress',
        amount: '',
      });

      const expectedContext = {
        ...mockContext,
        fee: '10',
        recipient: 'newAddressValidated',
      };

      await useCases.onFormInput('interface-id', SendFormEvent.Recipient);

      expect(mockAccountRepository.get).toHaveBeenCalled();
      expect(mockAccountRepository.getFrozenUTXOs).toHaveBeenCalled();
      expect(mockTxBuilder.feeRate).toHaveBeenCalled();
      expect(mockTxBuilder.unspendable).toHaveBeenCalled();
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        mockContext.amount,
        'newAddressValidated',
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });
  });

  describe('onReviewInput', () => {
    const mockContext: ReviewTransactionContext = {
      from: 'myAddress',
      network: 'bitcoin',
      amount: '10000',
      currency: CurrencyUnit.Bitcoin,
      recipient: 'recipientAddress',
      feeRate: 2.4,
      fee: '10',
      sendForm: {} as SendFormContext,
    };

    it('throws error unrecognized event', async () => {
      await expect(
        useCases.onReviewInput(
          'interface-id',
          'randomEvent' as ReviewTransactionEvent,
          mockContext,
        ),
      ).rejects.toThrow('Unrecognized event');
    });

    it('resolves to null on HeaderBack if missing send form in context', async () => {
      await useCases.onReviewInput(
        'interface-id',
        ReviewTransactionEvent.HeaderBack,
        { ...mockContext, sendForm: undefined },
      );
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        null,
      );
    });

    it('reverts interface back to send form if present in context', async () => {
      await useCases.onReviewInput(
        'interface-id',
        ReviewTransactionEvent.HeaderBack,
        mockContext,
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        mockContext.sendForm,
      );
    });

    it('resolves to the transaction request on Send', async () => {
      await useCases.onReviewInput(
        'interface-id',
        ReviewTransactionEvent.Send,
        mockContext,
      );

      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        {
          amount: mockContext.amount,
          recipient: mockContext.recipient,
          feeRate: mockContext.feeRate,
        },
      );
    });
  });

  describe('refreshRates', () => {
    const mockFeeEstimates = mock<FeeEstimates>({ get: jest.fn() });
    const mockContext = mock<SendFormContext>({
      network: 'bitcoin',
    });
    const mockExchangeRates = mock<ExchangeRates>({
      usd: { value: 200000 },
    });
    const mockPreferences = mock<GetPreferencesResult>({ currency: 'usd' });

    beforeEach(() => {
      mockSnapClient.getInterfaceContext.mockResolvedValue(mockContext);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockRatesClient.exchangeRates.mockResolvedValue(mockExchangeRates);
      mockSnapClient.scheduleBackgroundEvent.mockResolvedValue('event-id');
      mockSnapClient.getPreferences.mockResolvedValue(mockPreferences);
    });

    it('returns if interface is not found', async () => {
      mockSnapClient.getInterfaceContext.mockResolvedValueOnce(undefined);

      await useCases.refreshRates('interface-id');
      expect(mockSnapClient.scheduleBackgroundEvent).not.toHaveBeenCalled();
      expect(mockSendFlowRepository.updateForm).not.toHaveBeenCalled();
    });

    it.only('schedules next event if fetching rates fail', async () => {
      mockChain.getFeeEstimates.mockRejectedValueOnce(
        new Error('getFeeEstimates'),
      );

      await useCases.refreshRates('interface-id');

      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalled();
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        {
          ...mockContext,
          network: 'bitcoin',
          backgroundEventId: 'event-id',
        },
      );
    });

    it('sets fee and exchange rates successfully', async () => {
      (mockFeeEstimates.get as jest.Mock).mockReturnValue(4.4);

      await useCases.refreshRates('interface-id');

      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalledWith(
        ratesRefreshInterval,
        SendFormEvent.RefreshRates,
        'interface-id',
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        {
          ...mockContext,
          backgroundEventId: 'event-id',
          exchangeRate: {
            conversionRate: 200000,
            conversionDate: expect.any(Number),
            currency: 'USD',
          },
          feeRate: 4.4,
        },
      );
    });

    it('does not set exchange rate if network is not bitcoin', async () => {
      (mockFeeEstimates.get as jest.Mock).mockReturnValue(4.4);
      mockSnapClient.getInterfaceContext.mockResolvedValueOnce({
        ...mockContext,
        network: 'notBitcoin',
      });

      await useCases.refreshRates('interface-id');

      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalled();
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        {
          ...mockContext,
          backgroundEventId: 'event-id',
          network: 'notBitcoin',
          feeRate: 4.4,
        },
      );
    });

    it('propagates error if scheduleBackgroundEvent fails', async () => {
      const error = new Error('scheduleBackgroundEvent failed');
      mockSnapClient.scheduleBackgroundEvent.mockRejectedValue(error);

      await expect(useCases.refreshRates('interface-id')).rejects.toThrow(
        error,
      );
    });
  });
});
