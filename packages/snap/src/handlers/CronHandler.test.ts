import { getSelectedAccounts } from '@metamask/keyring-snap-sdk';
import type { SnapsProvider } from '@metamask/snaps-sdk';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount, SnapClient } from '../entities';
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
    });
  });

  describe('synchronizeAccounts', () => {
    const mockAccounts = [
      mock<BitcoinAccount>({ id: 'account-1' }),
      mock<BitcoinAccount>({ id: 'account-2' }),
    ];
    const request = { method: 'synchronizeAccounts' } as JsonRpcRequest;

    it('synchronizes all selected accounts', async () => {
      (getSelectedAccounts as jest.Mock).mockResolvedValue([
        'account-1',
        'account-2',
      ]);
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);

      await handler.route(request);

      expect(mockSnapClient.getClientStatus).toHaveBeenCalled();
      expect(mockAccountUseCases.list).toHaveBeenCalled();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(
        mockAccounts.length,
      );
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
      });
      await handler.route(request);

      expect(mockAccountUseCases.synchronize).not.toHaveBeenCalled();
    });

    it('throws error if some account fails to synchronize', async () => {
      (getSelectedAccounts as jest.Mock).mockResolvedValue([
        'account-1',
        'account-2',
      ]);
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize.mockRejectedValue(new Error('error'));

      await expect(handler.route(request)).rejects.toThrow(
        'Account synchronization failures',
      );

      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(
        mockAccounts.length,
      );
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
    const mockAccounts = [
      mock<BitcoinAccount>({ id: 'account-1' }),
      mock<BitcoinAccount>({ id: 'account-2' }),
      mock<BitcoinAccount>({ id: 'account-3' }),
    ];
    const request = {
      method: CronMethod.SyncSelectedAccounts,
      params: { accountIds: ['account-1', 'account-2'] },
    } as unknown as JsonRpcRequest;

    it('throws if invalid params', async () => {
      await expect(
        handler.route({ ...request, params: { invalid: true } }),
      ).rejects.toThrow('');
    });

    it('performs full scan on selected accounts', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);

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
    });

    it('returns early if the client is not active', async () => {
      mockSnapClient.getClientStatus.mockResolvedValue({
        active: false,
        locked: true,
      });
      await handler.route(request);

      expect(mockAccountUseCases.fullScan).not.toHaveBeenCalled();
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      mockAccountUseCases.list.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });

    it('completes successfully even if some accounts fail to scan', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('scan failed'));

      const result = await handler.route(request);

      expect(result).toBeUndefined();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(2);
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

    it('performs full scan on the specified account', async () => {
      mockAccountUseCases.get.mockResolvedValue(mockAccount);

      await handler.route(request);

      expect(mockAccountUseCases.get).toHaveBeenCalledWith('account-1');
      expect(mockAccountUseCases.fullScan).toHaveBeenCalledWith(mockAccount);
    });

    it('returns early if the client is not active', async () => {
      mockSnapClient.getClientStatus.mockResolvedValue({
        active: false,
        locked: true,
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
