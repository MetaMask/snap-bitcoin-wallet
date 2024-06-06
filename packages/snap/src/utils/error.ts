import {
  MethodNotFoundError,
  UserRejectedRequestError,
  MethodNotSupportedError,
  ParseError,
  ResourceNotFoundError,
  ResourceUnavailableError,
  TransactionRejected,
  ChainDisconnectedError,
  DisconnectedError,
  UnauthorizedError,
  UnsupportedMethodError,
  InternalError,
  InvalidInputError,
  InvalidParamsError,
  InvalidRequestError,
  LimitExceededError,
  SnapError,
} from '@metamask/snaps-sdk';

/**
 * Compacts an error to a specific error instance.
 *
 * @param error - The error instance to be compacted.
 * @param ErrCtor - The error constructor for the desired error instance.
 * @returns The compacted error instance.
 */
export function compactError<ErrorInstance extends Error>(
  error: ErrorInstance,
  ErrCtor: new (message?: string) => ErrorInstance,
): ErrorInstance {
  if (error instanceof ErrCtor) {
    return error;
  }
  return new ErrCtor(error.message);
}

/**
 * Determines if the given error is a Snap RPC error.
 *
 * @param error - The error instance to be checked.
 * @returns A boolean indicating whether the error is a Snap RPC error.
 */
export function isSnapRpcError(error: Error): boolean {
  const errors = [
    SnapError,
    MethodNotFoundError,
    UserRejectedRequestError,
    MethodNotSupportedError,
    MethodNotFoundError,
    ParseError,
    ResourceNotFoundError,
    ResourceUnavailableError,
    TransactionRejected,
    ChainDisconnectedError,
    DisconnectedError,
    UnauthorizedError,
    UnsupportedMethodError,
    InternalError,
    InvalidInputError,
    InvalidParamsError,
    InvalidRequestError,
    LimitExceededError,
  ];
  return errors.some((errType) => error instanceof errType);
}
