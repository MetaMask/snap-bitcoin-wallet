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

    it('wraps an unexpected Error and preserves its message', async () => {
      const error = new Error('boom');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(middleware.handle(mockFn)).rejects.toThrow('boom');
      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockTranslator.load).toHaveBeenCalledWith('en');
      expect(mockLogger.error).toHaveBeenCalledWith(error);
    });

    it('wraps a non-Error thrown value by stringifying it', async () => {
      const mockFn = jest.fn().mockRejectedValue('string failure');

      await expect(middleware.handle(mockFn)).rejects.toThrow('string failure');
      expect(mockLogger.error).toHaveBeenCalledWith('string failure');
    });

    it('wraps a thrown plain object by stringifying it', async () => {
      const thrown = { foo: 'bar' };
      const mockFn = jest.fn().mockRejectedValue(thrown);

      await expect(middleware.handle(mockFn)).rejects.toThrow(
        '[object Object]',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(thrown);
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
      expect(mockLogger.error).toHaveBeenCalledWith(error, error.data);
      expect(mockSnapClient.emitTrackingError).toHaveBeenCalledWith(error);
    });
  });
});
