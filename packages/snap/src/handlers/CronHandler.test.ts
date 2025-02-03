import { mock } from 'jest-mock-extended';

import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { CronHandler } from './CronHandler';

describe('CronHandler', () => {
  const mockAccountUseCases = mock<AccountUseCases>();
  let handler: CronHandler;

  beforeEach(() => {
    handler = new CronHandler(mockAccountUseCases);
  });

  describe('route', () => {
    it('synchronizes all accounts', async () => {
      await handler.route('synchronize');

      expect(mockAccountUseCases.synchronizeAll).toHaveBeenCalled();
    });

    it('propagates errors from synchronizeAll', async () => {
      const error = new Error();
      mockAccountUseCases.synchronizeAll.mockRejectedValue(error);

      await expect(handler.route('synchronize')).rejects.toThrow(error);
      expect(mockAccountUseCases.synchronizeAll).toHaveBeenCalled();
    });
  });
});
