import { SnapError, UnauthorizedError } from '@metamask/snaps-sdk';

import { isSnapRpcError } from '../entities';

export const mapError = (error: unknown): string => {
  if (error instanceof UnauthorizedError) {
    return 'Permission denied.';
  }
  return 'An internal error occurred.';
};

export const handle = async <ResponseT>(
  fn: () => Promise<ResponseT>,
): Promise<ResponseT> => {
  try {
    return await fn();
  } catch (error) {
    if (isSnapRpcError(error)) {
      throw error;
    }
    throw new SnapError(mapError(error));
  }
};
