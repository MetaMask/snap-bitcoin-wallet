import type { Json } from '@metamask/snaps-sdk';

export const createMockFetch = () => {
  const fetchSpy = jest.fn();
  // eslint-disable-next-line no-restricted-globals
  Object.defineProperty(global, 'fetch', {
    // Allow `fetch` to be redefined in the global scope
    writable: true,
    value: fetchSpy,
  });

  return {
    fetchSpy,
  };
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
}) => {
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
}) => {
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(mockResponse),
  });
};
