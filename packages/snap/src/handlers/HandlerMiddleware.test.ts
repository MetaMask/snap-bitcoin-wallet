import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import {
  type Logger,
  type SnapClient,
  type Translator,
  BaseError,
} from '../entities';
import { HandlerMiddleware } from './HandlerMiddleware';

describe('HandlerMiddleware', () => {
  const mockLogger = mock<Logger>();
  const mockSnapClient = mock<SnapClient>({
    getPreferences: jest.fn(),
  });
  const mockTranslator = mock<Translator>({
    load: jest.fn(),
  });

  const middleware = new HandlerMiddleware(
    mockLogger,
    mockSnapClient,
    mockTranslator,
  );

  beforeEach(() => {
    mockSnapClient.getPreferences.mockResolvedValue({
      locale: 'en',
    } as GetPreferencesResult);
    mockTranslator.load.mockResolvedValue({});
  });

  describe('handle', () => {
    it('executes the function successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await middleware.handle(mockFn);

      expect(result).toBe('success');
    });

    it('throws internal error if error is unexpected', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error());

      await expect(middleware.handle(mockFn)).rejects.toThrow(
        'Unexpected error',
      );
      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockTranslator.load).toHaveBeenCalledWith('en');
    });

    it('handles error successfully if instance of BaseError', async () => {
      const error = new BaseError('Test error', 1);
      const mockFn = jest.fn().mockRejectedValue(error);
      mockTranslator.load.mockResolvedValue({
        'error.1': { message: 'Test error' },
      });

      await expect(middleware.handle(mockFn)).rejects.toThrow('Test error');
      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockTranslator.load).toHaveBeenCalledWith('en');
      expect(mockLogger.error).toHaveBeenCalledWith(error);
      expect(mockSnapClient.emitTrackingError).toHaveBeenCalledWith(error);
    });
  });
});
