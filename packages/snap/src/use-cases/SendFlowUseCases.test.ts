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
} from '../entities';
import { CurrencyUnit, SendFormEvent } from '../entities';
import { SendFlowUseCases } from './SendFlowUseCases';

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('bitcoindevkit', () => {
  return {
    Address: {
      new: jest.fn(),
    },
    Amount: {
      from_btc: jest.fn(),
    },
  };
});

jest.mock('../utils/logger');

describe('SendFlowUseCases', () => {
  let useCases: SendFlowUseCases;

  const mockSnapClient = mock<SnapClient>();
  const mockAccountRepository = mock<BitcoinAccountRepository>();
  const mockSendFlowRepository = mock<SendFlowRepository>();
  const mockChain = mock<BlockchainClient>();
  const targetBlocksConfirmation = 3;
  const fallbackFeeRate = 5.0;
  const mockAccount = mock<BitcoinAccount>({
    network: 'bitcoin',
    drainTo: jest.fn(),
    buildTx: jest.fn(),
  });
  const mockFeeEstimates = mock<FeeEstimates>({ get: jest.fn() });
  const mockTxRequest = mock<TransactionRequest>();

  beforeEach(() => {
    useCases = new SendFlowUseCases(
      mockSnapClient,
      mockAccountRepository,
      mockSendFlowRepository,
      mockChain,
      targetBlocksConfirmation,
      fallbackFeeRate,
    );
  });

  describe('displayForm', () => {
    it('throws error if account not found', async () => {
      mockAccountRepository.get.mockResolvedValue(null);
      await expect(
        useCases.displayForm('non-existent-account'),
      ).rejects.toThrow('Account not found');
    });

    it('throws UserRejectedRequestError if displayInterface returns null', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockFeeEstimates.get.mockReturnValue(5);
      mockSendFlowRepository.insertForm.mockResolvedValue('form-id');
      mockSnapClient.displayInterface.mockResolvedValue(null);

      await expect(useCases.displayForm('account-id')).rejects.toThrow(
        UserRejectedRequestError,
      );
    });

    it('displays Send form and returns transaction request when resolved', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockFeeEstimates.get.mockReturnValue(5);
      mockSendFlowRepository.insertForm.mockResolvedValue('form-id');
      mockSnapClient.displayInterface.mockResolvedValue(mockTxRequest);

      const result = await useCases.displayForm('account-id');

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith(
        mockAccount.network,
      );
      expect(mockFeeEstimates.get).toHaveBeenCalledWith(
        targetBlocksConfirmation,
      );
      expect(mockSendFlowRepository.insertForm).toHaveBeenCalledWith(
        mockAccount,
        5,
      );
      expect(mockSnapClient.displayInterface).toHaveBeenCalledWith('form-id');
      expect(result).toStrictEqual(mockTxRequest);
    });
  });

  describe('update', () => {
    const mockContext: SendFormContext = {
      account: 'account-id',
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
      fiatRate: {
        currency: 'USD',
        conversionRate: 100000,
        conversionDate: 2025,
      },
    };

    it('throws error unrecognized event', async () => {
      await expect(
        useCases.updateForm(
          'form-id',
          'randomEvent' as SendFormEvent,
          mockContext,
        ),
      ).rejects.toThrow('Unrecognized event');
    });

    it('resolves to null on Cancel', async () => {
      await useCases.updateForm('form-id', SendFormEvent.Cancel, mockContext);
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'form-id',
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

      await useCases.updateForm(
        'form-id',
        SendFormEvent.ClearRecipient,
        mockContext,
      );
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'form-id',
        expectedContext,
      );
    });

    it('throws error on Review if amount or recipient are not defined', async () => {
      await expect(
        useCases.updateForm('form-id', SendFormEvent.Confirm, {
          ...mockContext,
          recipient: undefined,
        }),
      ).rejects.toThrow('Inconsistent Send form context');

      await expect(
        useCases.updateForm('form-id', SendFormEvent.Confirm, {
          ...mockContext,
          amount: undefined,
        }),
      ).rejects.toThrow('Inconsistent Send form context');
    });

    it('resolves to the transaction request on Review', async () => {
      await useCases.updateForm('form-id', SendFormEvent.Confirm, mockContext);
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith('form-id', {
        amount: mockContext.amount,
        recipient: mockContext.recipient,
        feeRate: mockContext.feeRate,
      });
    });

    it('clears state and set drain to true on SetMax', async () => {
      // avoid computing the fee in this test
      const testContext = {
        ...mockContext,
        recipient: undefined,
      };
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

      await useCases.updateForm('form-id', SendFormEvent.SetMax, testContext);
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'form-id',
        expectedContext,
      );
    });

    it('sets recipient from state on Recipient', async () => {
      (Address.new as jest.Mock).mockReturnValue({
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

      await useCases.updateForm(
        'form-id',
        SendFormEvent.Recipient,
        testContext,
      );

      expect(mockSendFlowRepository.getState).toHaveBeenCalledWith('form-id');
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'form-id',
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

      await useCases.updateForm('form-id', SendFormEvent.Amount, testContext);

      expect(mockSendFlowRepository.getState).toHaveBeenCalledWith('form-id');
      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'form-id',
        expectedContext,
      );
    });

    it('computes the fee when amount and recipient are filled', async () => {
      const mockPsbt = mock<Psbt>({
        fee: () => {
          return { to_sat: () => BigInt(10) } as unknown as Amount;
        },
      });
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockAccount.drainTo.mockReturnValue(mockPsbt);

      const expectedContext = {
        ...mockContext,
        drain: expect.anything(),
        fee: '10',
        amount: String(20000 - 10),
        errors: expect.anything(),
      };

      await useCases.updateForm('form-id', SendFormEvent.SetMax, mockContext);

      expect(mockSendFlowRepository.updateForm).toHaveBeenCalledWith(
        'form-id',
        expectedContext,
      );
    });
  });
});
