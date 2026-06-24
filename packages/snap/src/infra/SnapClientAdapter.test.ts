import type { WalletTx } from '@metamask/bitcoindevkit';
import { getJsonError } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount, Logger } from '../entities';
import { TrackingSnapEvent } from '../entities';
import { SnapClientAdapter } from './SnapClientAdapter';

/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Amount: {
    from_sat: jest.fn(() => ({
      to_btc: jest.fn(() => ({
        toString: jest.fn(() => '0'),
      })),
    })),
  },
}));
/* eslint-enable @typescript-eslint/naming-convention */

const setupTest = () => {
  const mockLogger = mock<Logger>();
  const mockRequest = jest.fn();
  const snapClient = new SnapClientAdapter(mockLogger);

  Object.defineProperty(globalThis, 'snap', {
    configurable: true,
    value: { request: mockRequest },
    writable: true,
  });

  return { snapClient, mockLogger, mockRequest };
};

describe('SnapClientAdapter', () => {
  describe('emitTrackingEvent', () => {
    it("doesn't throw and logs when event tracking fails", async () => {
      const { snapClient, mockLogger, mockRequest } = setupTest();

      const trackingError = new Error('event tracking failed');
      const account = mock<BitcoinAccount>({
        network: 'bitcoin',
        addressType: 'p2wpkh',
      });
      const tx = mock<WalletTx>({
        txid: { toString: () => 'txid-123' },
      });
      mockRequest.mockRejectedValue(trackingError);

      expect(
        await snapClient.emitTrackingEvent(
          TrackingSnapEvent.TransactionReceived,
          account,
          tx,
          'metamask',
        ),
      ).toBeUndefined();

      /* eslint-disable @typescript-eslint/naming-convention */
      expect(mockRequest).toHaveBeenCalledWith({
        method: 'snap_trackEvent',
        params: {
          event: {
            event: TrackingSnapEvent.TransactionReceived,
            properties: {
              origin: 'metamask',
              message: 'Snap transaction received',
              chain_id_caip: 'bip122:000000000019d6689c085ae165831e93',
              account_type: 'bip122:p2wpkh',
              tx_id: 'txid-123',
            },
          },
        },
      });
      /* eslint-enable @typescript-eslint/naming-convention */
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track event: Transaction Received',
        trackingError,
      );
    });
  });

  describe('emitTrackingError', () => {
    it('sends the tracking error payload to the snap client', async () => {
      const { snapClient, mockRequest } = setupTest();

      const error = new Error('boom');
      mockRequest.mockResolvedValue(undefined);

      expect(await snapClient.emitTrackingError(error)).toBeUndefined();

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

      expect(await snapClient.emitTrackingError(error)).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track error',
        trackingError,
      );
    });
  });

  describe('startTrace', () => {
    it('returns false and logs when starting a trace fails', async () => {
      const { snapClient, mockLogger, mockRequest } = setupTest();

      const traceError = new Error('trace failed');
      mockRequest.mockRejectedValue(traceError);

      expect(await snapClient.startTrace('Create Bitcoin Account')).toBe(false);

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'snap_startTrace',
        params: {
          name: 'Create Bitcoin Account',
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start trace',
        traceError,
      );
    });
  });

  describe('endTrace', () => {
    it('does not throw and logs when ending a trace fails', async () => {
      const { snapClient, mockLogger, mockRequest } = setupTest();

      const traceError = new Error('trace end failed');
      mockRequest.mockRejectedValue(traceError);

      expect(
        await snapClient.endTrace('Create Bitcoin Account'),
      ).toBeUndefined();

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'snap_endTrace',
        params: {
          name: 'Create Bitcoin Account',
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to end trace',
        traceError,
      );
    });
  });
});
