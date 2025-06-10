/* eslint-disable no-restricted-globals */

/**
 * Monkey patch for globalThis `fetch` introducing a retry mechanism on network error.
 *
 * @param maxRetries Max number of retries before failure.
 * @param baseDelay Base delay in ms for exponential decay.
 */
export function patchFetchNetworkErrors(maxRetries = 3, baseDelay = 500): void {
  if ((globalThis as any).__fetchPatched) {
    return;
  }

  const original = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await original(input, init);

        if (res.status !== 429 || attempt >= maxRetries) {
          return res;
        }
      } catch (error) {
        if (!(error instanceof TypeError) || attempt >= maxRetries) {
          throw error;
        }
      }

      // Exponential back‑off
      const delay = baseDelay * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  (globalThis as any).__fetchPatched = true;
}
