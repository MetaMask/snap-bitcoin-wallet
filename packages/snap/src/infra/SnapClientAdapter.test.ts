import { getJsonError } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { Logger } from '../entities';
import { SnapClientAdapter } from './SnapClientAdapter';

jest.mock('@metamask/bitcoindevkit', () => ({
  Amount: {
    from_sat: jest.fn(() => ({
      to_btc: jest.fn(() => ({
        toString: jest.fn(() => '0'),
      })),
    })),
  },
}));

const setupTest = () => {
  const mockLogger = mock<Logger>();
  const mockRequest = jest.fn();
  const snapClient = new SnapClientAdapter(false, mockLogger);

  Object.defineProperty(globalThis, 'snap', {
    configurable: true,
    value: { request: mockRequest },
    writable: true,
  });

  return { snapClient, mockLogger, mockRequest };
};

describe('SnapClientAdapter', () => {
  describe('emitTrackingError', () => {
    it('sends the tracking error payload to the snap client', async () => {
      const { snapClient, mockRequest } = setupTest();

      const error = new Error('boom');
      mockRequest.mockResolvedValue(undefined);

      await expect(
        snapClient.emitTrackingError(error),
      ).resolves.toBeUndefined();

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'snap_trackError',
        params: { error: getJsonError(error) },
      });
    });

    it("doesn't break execution when error tracking fails", async () => {
      const { snapClient, mockLogger, mockRequest } = setupTest();

      const error = new Error('boom');
      const trackingError = new Error('track failed');
      mockRequest.mockRejectedValue(trackingError);

      await expect(
        snapClient.emitTrackingError(error),
      ).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track error',
        trackingError,
      );
    });
    //   const { adapter, mockLogger, mockRequest } = setupTest();

    //   const error = new Error('boom');
    //   const trackingError = new Error('track failed');
    //   mockRequest.mockRejectedValue(trackingError);

    //   await adapter.emitTrackingError(error);

    //   expect(mockLogger.error).toHaveBeenCalledWith(
    //     'Failed to track error',
    //     trackingError,
    //   );
    // });
  });
});
