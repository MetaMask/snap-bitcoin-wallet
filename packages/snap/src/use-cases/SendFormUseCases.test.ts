import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import type { FeeEstimates } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  SendFormRepository,
  SnapClient,
  TransactionRequest,
} from '../entities';
import { SendFormUseCases } from './SendFormUseCases';

jest.mock('../utils/logger');

describe('SendFormUseCases', () => {
  let useCases: SendFormUseCases;

  const mockSnapClient = mock<SnapClient>();
  const mockAccountRepository = mock<BitcoinAccountRepository>();
  const mockSendFormRepository = mock<SendFormRepository>();
  const mockChain = mock<BlockchainClient>();
  const targetBlocksConfirmation = 3;
  const mockAccount = mock<BitcoinAccount>({ network: 'bitcoin' });
  const mockFeeEstimates = mock<FeeEstimates>({ get: jest.fn() });
  const mockTxRequest = mock<TransactionRequest>();

  beforeEach(() => {
    useCases = new SendFormUseCases(
      mockSnapClient,
      mockAccountRepository,
      mockSendFormRepository,
      mockChain,
      targetBlocksConfirmation,
    );
  });

  describe('display', () => {
    it('throws error if account not found', async () => {
      mockAccountRepository.get.mockResolvedValue(null);
      await expect(useCases.display('non-existent-account')).rejects.toThrow(
        'Account not found',
      );
    });

    it('throws error if fee rate is missing', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockFeeEstimates.get.mockReturnValue(undefined);

      await expect(useCases.display('account-id')).rejects.toThrow(
        'Failed to fetch fee rates',
      );
    });

    it('throws UserRejectedRequestError if displayInterface returns null', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockFeeEstimates.get.mockReturnValue(5);
      mockSendFormRepository.insert.mockResolvedValue('form-id');
      mockSnapClient.displayInterface.mockResolvedValue(null);

      await expect(useCases.display('account-id')).rejects.toThrow(
        UserRejectedRequestError,
      );
    });

    it('displays Send form and returns transaction request when resolved', async () => {
      mockAccountRepository.get.mockResolvedValue(mockAccount);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
      mockFeeEstimates.get.mockReturnValue(5);
      mockSendFormRepository.insert.mockResolvedValue('form-id');
      mockSnapClient.displayInterface.mockResolvedValue(mockTxRequest);

      const result = await useCases.display('account-1');

      expect(mockAccountRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith(
        mockAccount.network,
      );
      expect(mockFeeEstimates.get).toHaveBeenCalledWith(
        targetBlocksConfirmation,
      );
      expect(mockSendFormRepository.insert).toHaveBeenCalledWith(
        mockAccount,
        5,
      );
      expect(mockSnapClient.displayInterface).toHaveBeenCalledWith('form-id');
      expect(result).toStrictEqual(mockTxRequest);
    });
  });
});
