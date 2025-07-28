import { SnapError } from '@metamask/snaps-sdk';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';

import type { Logger, BitcoinAccount } from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';
import { CronHandler, CronMethod } from './CronHandler';

describe('CronHandler', () => {
  const mockLogger = mock<Logger>();
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountUseCases = mock<AccountUseCases>();

  const handler = new CronHandler(
    mockLogger,
    mockAccountUseCases,
    mockSendFlowUseCases,
  );

  describe('synchronizeAccounts', () => {
    const mockAccounts = [mock<BitcoinAccount>(), mock<BitcoinAccount>()];
    const request = { method: 'synchronizeAccounts' } as JsonRpcRequest;

    it('synchronizes all accounts', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);

      await handler.route(request);

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

    it('does not propagate errors from synchronize', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      const error = new Error();
      mockAccountUseCases.synchronize.mockRejectedValue(error);

      await handler.route(request);

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

    it('propagates errors from refresh', async () => {
      const error = new Error();
      mockSendFlowUseCases.refresh.mockRejectedValue(error);

      await expect(handler.route(request)).rejects.toThrow(error);
    });
  });
});
