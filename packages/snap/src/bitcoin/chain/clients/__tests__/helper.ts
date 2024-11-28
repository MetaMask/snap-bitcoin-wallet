import type { Json } from '@metamask/snaps-sdk';
import type { Network } from 'bitcoinjs-lib';

import { Config } from '../../../../config';
import type { BtcAccount } from '../../../wallet';
import { BtcAccountDeriver, BtcWallet } from '../../../wallet';

export const createMockFetch = (): jest.SpyInstance => {
  const fetchSpy = jest.fn();
  // eslint-disable-next-line no-restricted-globals
  Object.defineProperty(global, 'fetch', {
    // Allow `fetch` to be redefined in the global scope
    writable: true,
    value: fetchSpy,
  });

  return fetchSpy;
};

export const mockErrorResponse = ({
  fetchSpy,
  isOk = true,
  status = 200,
  statusText = 'error',
  errorResp = {
    result: null,
    error: null,
    id: null,
  },
}: {
  fetchSpy: jest.SpyInstance;
  isOk?: boolean;
  status?: number;
  statusText?: string;
  errorResp?: Record<string, Json>;
}): void => {
  fetchSpy.mockResolvedValueOnce({
    ok: isOk,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(errorResp),
  });
};

export const mockApiSuccessResponse = ({
  fetchSpy,
  mockResponse,
}: {
  fetchSpy: jest.SpyInstance;
  mockResponse: unknown;
}): void => {
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(mockResponse),
  });
};

export const createAccounts = async (
  network: Network,
  count: number,
): Promise<BtcAccount[]> => {
  const wallet = new BtcWallet(new BtcAccountDeriver(network), network);

  const accounts: BtcAccount[] = [];
  for (let i = 0; i < count; i++) {
    accounts.push(await wallet.unlock(i, Config.wallet.defaultAccountType));
  }

  return accounts;
};
