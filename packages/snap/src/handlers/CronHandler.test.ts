import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { CronHandler } from './CronHandler';

describe('CronHandler', () => {
  const mockAccountUseCases = mock<AccountUseCases>();
  const mockAccounts = [
    {
      id: 'id-1',
    },
    {
      id: 'id-2',
    },
  ] as BitcoinAccount[];
  let handler: CronHandler;

  beforeEach(() => {
    handler = new CronHandler(mockAccountUseCases);
  });

  describe('route', () => {
    it('synchronizes all accounts', async () => {
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);

      await handler.route('synchronize');

      expect(mockAccountUseCases.list).toHaveBeenCalled();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledWith('id-1');
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledWith('id-2');
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      mockAccountUseCases.list.mockRejectedValue(error);

      await expect(handler.route('synchronize')).rejects.toThrow(error);
      expect(mockAccountUseCases.list).toHaveBeenCalled();
    });

    it('propagates errors from synchronize', async () => {
      const error = new Error();
      mockAccountUseCases.list.mockResolvedValue(mockAccounts);
      mockAccountUseCases.synchronize.mockRejectedValue(error);

      await expect(handler.route('synchronize')).rejects.toThrow(error);
      expect(mockAccountUseCases.list).toHaveBeenCalled();
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledWith('id-1');
    });
  });
});
