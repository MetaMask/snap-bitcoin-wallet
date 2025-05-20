import type {
  FeeEstimates,
  Network,
  AddressInfo,
} from '@metamask/bitcoindevkit';
import { Psbt, Address, Amount } from '@metamask/bitcoindevkit';
import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type {
  SendFormContext,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  SendFlowRepository,
  SnapClient,
  ReviewTransactionContext,
  AssetRatesClient,
  Logger,
} from '../entities';
import {
  ReviewTransactionEvent,
  CurrencyUnit,
  SendFormEvent,
} from '../entities';
import { SendFlowUseCases } from './SendFlowUseCases';
import { CronMethod } from '../handlers';

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => {
  return {
    Address: {
      from_string: jest.fn(),
    },
    Amount: {
      from_btc: jest.fn(),
    },
    Psbt: { from_string: jest.fn() },
  };
});

describe('SendFlowUseCases', () => {
  const mockLogger = mock<Logger>();
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
    id: 'acc-id',
    // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
    /* eslint-disable @typescript-eslint/naming-convention */
    balance: { trusted_spendable: { to_sat: () => BigInt(1234) } },
    peekAddress: jest.fn(),
  });
  const mockPreferences = mock<GetPreferencesResult>({
    currency: 'usd',
    locale: 'en',
  });
  const mockPsbt = mock<Psbt>({
    toString: jest.fn(),
  });

  const useCases = new SendFlowUseCases(
    mockLogger,
    mockSnapClient,
    mockAccountRepository,
    mockSendFlowRepository,
    mockChain,
    mockRatesClient,
    targetBlocksConfirmation,
    fallbackFeeRate,
    ratesRefreshInterval,
  );

  describe('displayForm', () => {
    beforeEach(() => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockAccount.peekAddress.mockReturnValue(
        mock<AddressInfo>({
          address: mock<Address>({ toString: () => 'myAddress' }),
        }),
      );
      mockSendFlowRepository.insertForm.mockResolvedValue('interface-id');
      mockSnapClient.getPreferences.mockResolvedValue(mockPreferences);
    });

    it('throws error if account not found', async () => {
      mockAccountRepository.get.mockResolvedValue(null);
      await expect(useCases.display('non-existent-account')).rejects.toThrow(
        'Account not found',
      );
    });

    it('throws UserRejectedRequestError if displayInterface returns null', async () => {
      mockSnapClient.displayInterface.mockResolvedValue(null);

      await expect(useCases.display('account-id')).rejects.toThrow(
        UserRejectedRequestError,
      );
    });

    it('displays Send form and returns PSBT when resolved', async () => {
      (Psbt.from_string as jest.Mock).mockReturnValue(mockPsbt);
      mockSnapClient.displayInterface.mockResolvedValue('psbtBase64');

      const result = await useCases.display('account-id');

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockSendFlowRepository.insertForm).toHaveBeenCalledWith({
        balance: '1234',
        currency: CurrencyUnit.Bitcoin,
        account: { id: 'acc-id', address: 'myAddress' },
        network: 'bitcoin',
        feeRate: fallbackFeeRate,
        errors: {},
        locale: 'en',
      });
      expect(mockSnapClient.displayInterface).toHaveBeenCalledWith(
        'interface-id',
      );
      expect(mockChain.getFeeEstimates).toHaveBeenCalled();
      expect(Psbt.from_string).toHaveBeenCalledWith('psbtBase64');
      expect(result).toStrictEqual(mockPsbt);
    });
  });

  describe('onChangeForm', () => {
    const mockOutPoint = 'txid:vout';
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
      backgroundEventId: 'backgroundEventId',
      locale: 'en',
    };
    const mockTxBuilder = {
      addRecipient: jest.fn(),
      feeRate: jest.fn(),
      drainTo: jest.fn(),
      drainWallet: jest.fn(),
      finish: jest.fn(),
      unspendable: jest.fn(),
    };

    beforeEach(() => {
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.addRecipient.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainTo.mockReturnThis();
      mockTxBuilder.drainWallet.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
    });

    it('throws error unrecognized event', async () => {
      await expect(
        useCases.onChangeForm(
          'interface-id',
          'randomEvent' as SendFormEvent,
          mockContext,
        ),
      ).rejects.toThrow('Unrecognized event');
    });

    it('resolves to null on Cancel', async () => {
      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.Cancel,
        mockContext,
      );
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        null,
      );
      expect(mockSnapClient.cancelBackgroundEvent).toHaveBeenCalledWith(
        mockContext.backgroundEventId,
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

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.ClearRecipient,
        mockContext,
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        expectedContext,
      );
    });

    it('throws error on Review if amount or recipient are not defined', async () => {
      await expect(
        useCases.onChangeForm('interface-id', SendFormEvent.Confirm, {
          ...mockContext,
          recipient: undefined,
        }),
      ).rejects.toThrow('Inconsistent Send form context');

      await expect(
        useCases.onChangeForm('interface-id', SendFormEvent.Confirm, {
          ...mockContext,
          amount: undefined,
        }),
      ).rejects.toThrow('Inconsistent Send form context');
    });

    it('updates interface to the drain transaction review on Confirm', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockAccountRepository.getFrozenUTXOs.mockResolvedValue([mockOutPoint]);
      mockPsbt.toString.mockReturnValue('psbtBase64');
      const expectedReviewContext: ReviewTransactionContext = {
        from: mockContext.account.address,
        network: mockContext.network,
        amount: '1000',
        recipient: 'recipientAddress',
        exchangeRate: mockContext.exchangeRate,
        currency: mockContext.currency,
        sendForm: { ...mockContext, drain: true },
        locale: 'en',
        psbt: 'psbtBase64',
      };

      await useCases.onChangeForm('interface-id', SendFormEvent.Confirm, {
        ...mockContext,
        drain: true,
      });

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockAccountRepository.getFrozenUTXOs).toHaveBeenCalledWith(
        'account-id',
      );
      expect(mockAccount.buildTx).toHaveBeenCalled();
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(mockContext.feeRate);
      expect(mockTxBuilder.drainWallet).toHaveBeenCalled();
      expect(mockTxBuilder.drainTo).toHaveBeenCalledWith(mockContext.recipient);
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith([mockOutPoint]);
      expect(mockSendFlowRepository.updateReview).toHaveBeenCalledWith(
        'interface-id',
        expectedReviewContext,
      );
    });

    it('updates interface to the transaction review on Confirm', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockAccountRepository.getFrozenUTXOs.mockResolvedValue([mockOutPoint]);
      mockPsbt.toString.mockReturnValue('psbtBase64');
      const expectedReviewContext: ReviewTransactionContext = {
        from: mockContext.account.address,
        network: mockContext.network,
        amount: '1000',
        recipient: 'recipientAddress',
        exchangeRate: mockContext.exchangeRate,
        currency: mockContext.currency,
        sendForm: mockContext,
        locale: 'en',
        psbt: 'psbtBase64',
      };

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.Confirm,
        mockContext,
      );

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockAccountRepository.getFrozenUTXOs).toHaveBeenCalledWith(
        'account-id',
      );
      expect(mockAccount.buildTx).toHaveBeenCalled();
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(mockContext.feeRate);
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        mockContext.amount,
        mockContext.recipient,
      );
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith([mockOutPoint]);
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
      mockSendFlowRepository.getContext.mockResolvedValueOnce(testContext);

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

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.SetMax,
        testContext,
      );
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

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.Recipient,
        testContext,
      );

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

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.Amount,
        testContext,
      );

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

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.SetMax,
        mockContext,
      );

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

      await useCases.onChangeForm(
        'interface-id',
        SendFormEvent.Recipient,
        mockContext,
      );

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

  describe('onChangeReview', () => {
    const mockContext: ReviewTransactionContext = {
      from: 'myAddress',
      network: 'bitcoin',
      amount: '10000',
      currency: CurrencyUnit.Bitcoin,
      recipient: 'recipientAddress',
      sendForm: {
        network: 'bitcoin',
      } as SendFormContext,
      locale: 'en',
      psbt: 'psbt',
    };

    it('throws error unrecognized event', async () => {
      await expect(
        useCases.onChangeReview(
          'interface-id',
          'randomEvent' as ReviewTransactionEvent,
          mockContext,
        ),
      ).rejects.toThrow('Unrecognized event');
    });

    it('resolves to null on HeaderBack if missing send form in context', async () => {
      await useCases.onChangeReview(
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
      const id = 'interface-id';
      mockSnapClient.getPreferences.mockResolvedValue(mockPreferences);

      await useCases.onChangeReview(
        id,
        ReviewTransactionEvent.HeaderBack,
        mockContext,
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        id,
        mockContext.sendForm,
      );
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith(
        mockContext.network,
      );
    });

    it('resolves to the transaction request on Send', async () => {
      await useCases.onChangeReview(
        'interface-id',
        ReviewTransactionEvent.Send,
        mockContext,
      );

      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        mockContext.psbt,
      );
    });
  });

  describe('refreshRates', () => {
    const mockFeeEstimates = mock<FeeEstimates>({ get: jest.fn() });
    const mockContext: SendFormContext = {
      account: { id: 'account-id', address: 'myAddress' },
      balance: '20000',
      currency: CurrencyUnit.Bitcoin,
      recipient: 'recipientAddress',
      errors: {},
      network: 'bitcoin',
      feeRate: fallbackFeeRate,
      locale: 'en',
    };
    const mockExchangeRates = {
      usd: { value: 200000 },
    };
    const mockFeeRate = 4.4;

    beforeEach(() => {
      mockSendFlowRepository.getContext.mockResolvedValue(mockContext);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockRatesClient.exchangeRates.mockResolvedValue(mockExchangeRates);
      mockSnapClient.scheduleBackgroundEvent.mockResolvedValue('event-id');
      mockSnapClient.getPreferences.mockResolvedValue(mockPreferences);
    });

    it('schedules next event if fetching rates fail', async () => {
      mockChain.getFeeEstimates.mockRejectedValueOnce(
        new Error('getFeeEstimates'),
      );

      await useCases.refresh('interface-id');

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
      (mockFeeEstimates.get as jest.Mock).mockReturnValue(mockFeeRate);

      await useCases.refresh('interface-id');

      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalledWith(
        ratesRefreshInterval,
        CronMethod.RefreshRates,
        'interface-id',
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        {
          ...mockContext,
          backgroundEventId: 'event-id',
          exchangeRate: {
            conversionRate: mockExchangeRates.usd.value,
            conversionDate: expect.any(Number),
            currency: 'USD',
          },
          feeRate: mockFeeRate,
        },
      );
    });

    it('does not set exchange rate if network is not bitcoin', async () => {
      (mockFeeEstimates.get as jest.Mock).mockReturnValue(mockFeeRate);
      mockSendFlowRepository.getContext.mockResolvedValueOnce({
        ...mockContext,
        network: 'notBitcoin' as Network,
      });

      await useCases.refresh('interface-id');

      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalled();
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        {
          ...mockContext,
          backgroundEventId: 'event-id',
          network: 'notBitcoin',
          feeRate: mockFeeRate,
        },
      );
    });

    it('does not set exchange rate if currency is not supported', async () => {
      (mockFeeEstimates.get as jest.Mock).mockReturnValue(mockFeeRate);
      mockSnapClient.getPreferences.mockResolvedValue({
        ...mockPreferences,
        currency: 'unknown',
      });

      await useCases.refresh('interface-id');

      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalled();
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'interface-id',
        {
          ...mockContext,
          backgroundEventId: 'event-id',
          feeRate: mockFeeRate,
        },
      );
    });

    it('propagates error if scheduleBackgroundEvent fails', async () => {
      const error = new Error('scheduleBackgroundEvent failed');
      mockSnapClient.scheduleBackgroundEvent.mockRejectedValue(error);

      await expect(useCases.refresh('interface-id')).rejects.toThrow(error);
    });
  });
});
