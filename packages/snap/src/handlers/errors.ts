import { SnapError } from '@metamask/snaps-sdk';

export const handle = async <ResponseT>(
  fn: () => Promise<ResponseT>,
): Promise<ResponseT> => {
  try {
    return await fn();
  } catch (error) {
    // TODO: Improve error handling in the following way:
    // 1. Use custom error types in the use cases with the initial error message (+context if necessary).
    // 2. Log the error using the context from the custom error.
    // 3. Map the error to a user-friendly message.
    // 4. Throw the more aligned error type from the Snaps SDK.
    // 5. Default to InternalError('an internal error occurred') if no custom error is thrown.

    // console.error('Error occurred:', error);
    throw new SnapError(error);
  }
};
