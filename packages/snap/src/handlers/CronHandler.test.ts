import type { WalletTx } from '@metamask/bitcoindevkit';
import { getSelectedAccounts } from '@metamask/keyring-snap-sdk';
import type { SnapsProvider, JsonRpcRequest } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount, SnapClient, SyncResult } from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';
import { CronHandler, CronMethod } from './CronHandler';

jest.mock('@metamask/keyring-snap-sdk', () => ({
  getSelectedAccounts: jest.fn(),
}));

describe('CronHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountUseCases = mock<AccountUseCases>();
  const mockSnapClient = mock<SnapClient>();
  const mockSnap = mock<SnapsProvider>();

  const handler = new CronHandler(
    mockAccountUseCases,
    mockSendFlowUseCases,
    mockSnapClient,
    mockSnap,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapClient.getClientStatus.mockResolvedValue({
      active: true,
      locked: false,
      clientVersion: '1.0.0',
      platformVersion: '1.0.0',
    });
  });

  describe('synchronizeAccounts', () => {
    const mockAccount1 = mock<BitcoinAccount>({ id: 'account-1' });
    const mockAccount2 = mock<BitcoinAccount>({ id: 'account-2' });
    const mockAccounts = [mockAccount1, mockAccount2];
    const request = { method: 'synchronizeAccounts' } as JsonRpcRequest;

    it('synchronizes all selected accounts and emits batched events', async () => {
      const mockResult1: SyncResult = {
        account: mockAccount1,
        transactionsToNotify: [],
      };
      const mockResult2: SyncResult = {
        account: mockAccount2,
        transactionsToNotify: [],
      };
      (getSelectedAccounts as jest.Mock).mockResolvedValue([
        'account-1',
        'account-2',
      ]);
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      await handler.route(request);

      expect(mockSnapClient.getClientStatus).toHaveBeenCalled();
      expect(mockAccountUseCases.list).toHaveBeenCalled();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(
        mockAccounts.length,
      );
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccounts);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledTimes(1);
    });

    it('emits transaction events for accounts with new transactions', async () => {
      const mockTx = mock<WalletTx>();
      const mockResult1: SyncResult = {
        account: mockAccount1,
        transactionsToNotify: [mockTx],
      };
      const mockResult2: SyncResult = {
        account: mockAccount2,
        transactionsToNotify: [],
      };
      (getSelectedAccounts as jest.Mock).mockResolvedValue([
        'account-1',
        'account-2',
      ]);
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      await handler.route(request);

      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount1, [mockTx]);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      (getSelectedAccounts as jest.Mock).mockResolvedValue(['account-1']);
      mockAccountUseCases.list.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });

    it('returns early if the client is not active', async () => {
      mockSnapClient.getClientStatus.mockResolvedValue({
        active: false,
        locked: true,
        clientVersion: '1.0.0',
        platformVersion: '1.0.0',
      });
      await handler.route(request);

      expect(mockAccountUseCases.synchronize).not.toHaveBeenCalled();
    });

    it('throws error if some account fails but still emits for successful ones', async () => {
      const mockResult: SyncResult = {
        account: mockAccount1,
        transactionsToNotify: [],
      };
      (getSelectedAccounts as jest.Mock).mockResolvedValue([
        'account-1',
        'account-2',
      ]);
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize
        .mockResolvedValueOnce(mockResult)
        .mockRejectedValueOnce(new Error('error'));

      await expect(handler.route(request)).rejects.toThrow(
        'Account synchronization failures',
      );

      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(
        mockAccounts.length,
      );
      // Should still emit for successful account
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith([mockAccounts[0]]);
    });
  });

  describe('refreshRates', () => {
    const request = {
      method: CronMethod.RefreshRates,
      params: { interfaceId: 'id' },
    } as unknown as JsonRpcRequest;

    it('throws if invalid params', async () => {
      await expect(
        handler.route({ ...request, params: { invalid: true } }),
      ).rejects.toThrow('');
    });

    it('refreshes the send form rates', async () => {
      await handler.route(request);

      expect(mockSendFlowUseCases.refresh).toHaveBeenCalledWith('id');
    });

    it('returns early if the client is not active', async () => {
      mockSnapClient.getClientStatus.mockResolvedValue({
        active: false,
        locked: true,
        clientVersion: '1.0.0',
        platformVersion: '1.0.0',
      });
      await handler.route(request);

      expect(mockSendFlowUseCases.refresh).not.toHaveBeenCalled();
    });

    it('propagates errors from refresh', async () => {
      const error = new Error();
      mockSendFlowUseCases.refresh.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });
  });

  describe('syncSelectedAccounts', () => {
    const mockAccount1 = mock<BitcoinAccount>({ id: 'account-1' });
    const mockAccount2 = mock<BitcoinAccount>({ id: 'account-2' });
    const mockAccount3 = mock<BitcoinAccount>({ id: 'account-3' });
    const mockAccounts = [mockAccount1, mockAccount2, mockAccount3];
    const request = {
      method: CronMethod.SyncSelectedAccounts,
      params: { accountIds: ['account-1', 'account-2'] },
    } as unknown as JsonRpcRequest;

    it('throws if invalid params', async () => {
      await expect(
        handler.route({ ...request, params: { invalid: true } }),
      ).rejects.toThrow('');
    });

    it('synchronizes selected accounts and emits batched events', async () => {
      const mockResult1: SyncResult = {
        account: mockAccount1,
        transactionsToNotify: [],
      };
      const mockResult2: SyncResult = {
        account: mockAccount2,
        transactionsToNotify: [],
      };
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      await handler.route(request);

      expect(mockAccountUseCases.list).toHaveBeenCalled();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(2);
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledWith(
        mockAccounts[0],
        'metamask',
      );
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledWith(
        mockAccounts[1],
        'metamask',
      );
      // Verify batched balance event
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith([mockAccounts[0], mockAccounts[1]]);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledTimes(1);
    });

    it('returns early if the client is not active', async () => {
      mockSnapClient.getClientStatus.mockResolvedValue({
        active: false,
        locked: true,
        clientVersion: '1.0.0',
        platformVersion: '1.0.0',
      });
      await handler.route(request);

      expect(mockAccountUseCases.synchronize).not.toHaveBeenCalled();
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      mockAccountUseCases.list.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });

    it('emits events only for successful accounts when some fail', async () => {
      const mockResult: SyncResult = {
        account: mockAccount1,
        transactionsToNotify: [],
      };
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize
        .mockResolvedValueOnce(mockResult)
        .mockRejectedValueOnce(new Error('scan failed'));

      const result = await handler.route(request);

      expect(result).toBeUndefined();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(2);
      // Should emit for successful account only
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith([mockAccounts[0]]);
    });
  });

  describe('fullScanAccount', () => {
    const mockAccount = mock<BitcoinAccount>({ id: 'account-1' });
    const request = {
      method: CronMethod.FullScanAccount,
      params: { accountId: 'account-1' },
    } as unknown as JsonRpcRequest;

    it('throws if invalid params', async () => {
      await expect(
        handler.route({ ...request, params: { invalid: true } }),
      ).rejects.toThrow('');
    });

    it('performs full scan and emits events', async () => {
      const mockTxs = [mock<WalletTx>()];
      const mockResult: SyncResult = {
        account: mockAccount,
        transactionsToNotify: mockTxs,
      };
      mockAccountUseCases.get.mockResolvedValue(mockAccount);
      mockAccountUseCases.fullScan.mockResolvedValue(mockResult);

      await handler.route(request);

      expect(mockAccountUseCases.get).toHaveBeenCalledWith('account-1');
      expect(mockAccountUseCases.fullScan).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith([mockAccount]);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, mockTxs);
    });

    it('returns early if the client is not active', async () => {
      mockSnapClient.getClientStatus.mockResolvedValue({
        active: false,
        locked: true,
        clientVersion: '1.0.0',
        platformVersion: '1.0.0',
      });
      await handler.route(request);

      expect(mockAccountUseCases.get).not.toHaveBeenCalled();
      expect(mockAccountUseCases.fullScan).not.toHaveBeenCalled();
    });

    it('propagates errors from get', async () => {
      const error = new Error('get failed');
      mockAccountUseCases.get.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });

    it('propagates errors from fullScan', async () => {
      const error = new Error('fullScan failed');
      mockAccountUseCases.get.mockResolvedValue(mockAccount);
      mockAccountUseCases.fullScan.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });
  });
});
