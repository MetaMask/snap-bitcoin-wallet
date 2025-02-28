import { mock } from 'jest-mock-extended';

import { SendFormEvent, type BitcoinAccount } from '../entities';
import type { ILogger } from '../infra/logger';
import type { SendFlowUseCases } from '../use-cases';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { CronHandler } from './CronHandler';

jest.mock('../infra/logger', () => {
  return { logger: mock<ILogger>() };
});

describe('CronHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountUseCases = mock<AccountUseCases>();
  let handler: CronHandler;

  beforeEach(() => {
    handler = new CronHandler(mockAccountUseCases, mockSendFlowUseCases);
  });

  describe('synchronizeAccounts', () => {
    const mockAccounts = [mock<BitcoinAccount>(), mock<BitcoinAccount>()];

    it('synchronizes all accounts', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);

      await handler.route('synchronizeAccounts');

      expect(mockAccountUseCases.list).toHaveBeenCalled();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(2);
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      mockAccountUseCases.list.mockRejectedValue(error);

      await expect(handler.route('synchronizeAccounts')).rejects.toThrow(error);
    });

    it('does not propagate errors from synchronize', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      const error = new Error();
      mockAccountUseCases.synchronize.mockRejectedValue(error);

      await handler.route('synchronizeAccounts');

      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshRates', () => {
    it('throws if invalid params', async () => {
      await expect(
        handler.route(SendFormEvent.RefreshRates, { invalid: 'id' }),
      ).rejects.toThrow('');
    });

    it('synchronizes all accounts', async () => {
      await handler.route(SendFormEvent.RefreshRates, { interfaceId: 'id' });

      expect(mockSendFlowUseCases.refreshRates).toHaveBeenCalledWith('id');
    });

    it('propagates errors from refreshRates', async () => {
      const error = new Error();
      mockSendFlowUseCases.refreshRates.mockRejectedValue(error);

      await expect(
        handler.route(SendFormEvent.RefreshRates, { interfaceId: 'id' }),
      ).rejects.toThrow(error);
    });
  });
});
