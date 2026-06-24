import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import {
  type Logger,
  type SnapClient,
  type Translator,
  BaseError,
  ExternalServiceError,
  UserActionError,
} from '../entities';
import { HandlerMiddleware, shouldTrackError } from './HandlerMiddleware';

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
    jest.clearAllMocks();
    mockSnapClient.getPreferences.mockResolvedValue({
      locale: 'en',
    } as GetPreferencesResult);
    mockTranslator.load.mockResolvedValue({});
  });

  describe('shouldTrackError', () => {
    it('returns false for canceled confirmation errors', () => {
      expect(
        shouldTrackError(
          new UserActionError('User canceled the confirmation'),
          mockLogger,
        ),
      ).toBe(false);
    });

    it('returns true for other errors', () => {
      expect(shouldTrackError(new Error('boom'), mockLogger)).toBe(true);
      expect(
        shouldTrackError(
          new UserActionError('Another user action'),
          mockLogger,
        ),
      ).toBe(true);
    });
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

    it('tracks an unexpected Error before rethrowing it as a SnapError', async () => {
      const error = new Error('tracked boom');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(middleware.handle(mockFn)).rejects.toThrow('tracked boom');
      expect(mockSnapClient.emitTrackingError).toHaveBeenCalledWith(error);
    });

    it('continues to throw a SnapError when emitTrackingError fails', async () => {
      const error = new Error('boom after tracking failure');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(middleware.handle(mockFn)).rejects.toThrow(error);

      expect(mockSnapClient.emitTrackingError).toHaveBeenCalledWith(error);
      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
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

    it('includes the concrete external service failure in the returned error message', async () => {
      const error = new ExternalServiceError('Failed to synchronize account', {
        account: 'account-1',
      });
      const mockFn = jest.fn().mockRejectedValue(error);
      mockTranslator.load.mockResolvedValue({
        'error.3000': { message: 'Connection error' },
      });

      await expect(middleware.handle(mockFn)).rejects.toThrow(
        'Connection error: Failed to synchronize account',
      );
      expect(mockSnapClient.emitTrackingError).toHaveBeenCalledWith(error);
    });
  });
});
