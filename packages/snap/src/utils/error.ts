/**
 * Compact error to a specific error instance.
 *
 * @param error - Error instance.
 * @param ErrCtor - Error constructor.
 * @returns Compacted Error instance.
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
