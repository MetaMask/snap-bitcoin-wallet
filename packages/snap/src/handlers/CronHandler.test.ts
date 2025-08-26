import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount, SnapClient } from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';
import { CronHandler, CronMethod } from './CronHandler';

describe('CronHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountUseCases = mock<AccountUseCases>();
  const mockSnapClient = mock<SnapClient>();

  const handler = new CronHandler(
    mockAccountUseCases,
    mockSendFlowUseCases,
    mockSnapClient,
  );

  beforeEach(() => {
    mockSnapClient.getClientStatus.mockResolvedValue({
      active: true,
      locked: false,
    });
  });

  describe('synchronizeAccounts', () => {
    const mockAccounts = [mock<BitcoinAccount>(), mock<BitcoinAccount>()];
    const request = { method: 'synchronizeAccounts' } as JsonRpcRequest;

    it('synchronizes all accounts', async () => {
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
});
