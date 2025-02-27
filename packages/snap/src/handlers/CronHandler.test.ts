import { mock } from 'jest-mock-extended';

import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { CronHandler } from './CronHandler';
import { BitcoinAccount } from '../entities';

describe('CronHandler', () => {
  const mockAccountUseCases = mock<AccountUseCases>();
  let handler: CronHandler;

  beforeEach(() => {
    handler = new CronHandler(mockAccountUseCases);
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

    it('propagates errors from synchronize', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      const error = new Error();
      mockAccountUseCases.synchronize.mockRejectedValue(error);

      await expect(handler.route('synchronizeAccounts')).rejects.toThrow(error);
    });
  });
});
