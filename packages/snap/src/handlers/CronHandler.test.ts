import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import type { ILogger } from '../infra/logger';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { CronHandler } from './CronHandler';
import { SendFlowUseCases } from '../use-cases';

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
});
