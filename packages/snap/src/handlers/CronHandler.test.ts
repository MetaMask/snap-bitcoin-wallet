import { mock } from 'jest-mock-extended';

import { SendFormEvent, type BitcoinAccount } from '../entities';
import type { ILogger } from '../infra/logger';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';
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
      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(
        mockAccounts.length,
      );
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

      expect(mockAccountUseCases.synchronize).toHaveBeenCalledTimes(
        mockAccounts.length,
      );
    });
  });

  describe('refreshRates', () => {
    it('throws if invalid params', async () => {
      await expect(
        handler.route(SendFormEvent.RefreshRates, { invalid: 'id' }),
      ).rejects.toThrow('');
    });

    it('refreshes the send form rates', async () => {
      const interfaceId = 'id';
      await handler.route(SendFormEvent.RefreshRates, { interfaceId });

      expect(mockSendFlowUseCases.onChangeForm).toHaveBeenCalledWith(
        interfaceId,
        SendFormEvent.RefreshRates,
      );
    });

    it('propagates errors from onFormInput', async () => {
      const error = new Error();
      mockSendFlowUseCases.onChangeForm.mockRejectedValue(error);

      await expect(
        handler.route(SendFormEvent.RefreshRates, { interfaceId: 'id' }),
      ).rejects.toThrow(error);
    });
  });
});
