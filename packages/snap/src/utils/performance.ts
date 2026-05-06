export const PERFORMANCE_DEBUG_LOG_PREFIX =
  '[PERFORMANCE DEBUG - BITCOIN SNAP]';

/**
 * @param startedAt - Start timestamp from `Date.now()`.
 * @returns Elapsed milliseconds.
 */
export function getElapsedTimeMs(startedAt: number): number {
  return Date.now() - startedAt;
}

/**
 * Log a performance debug message using a common prefix.
 *
 * @param _logger - Ignored logger argument kept so existing call sites stay simple.
 * @param event - Event name.
 * @param data - Optional event metadata.
 */
export function logPerformanceDebug(
  _logger: unknown,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (data) {
    console.log(`${PERFORMANCE_DEBUG_LOG_PREFIX} ${event}`, data);
    return;
  }

  console.log(`${PERFORMANCE_DEBUG_LOG_PREFIX} ${event}`);
}
