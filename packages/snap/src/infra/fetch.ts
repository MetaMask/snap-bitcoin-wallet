export function patchFetch(maxRetries = 3, baseDelay = 500) {
  if ((globalThis as any).__fetchPatched) return;

  const original = globalThis.fetch.bind(globalThis);
  console.debug('[patchFetch] installing fetch 429 retry wrapper');

  /** Clone the input so we can retry even for POST requests with bodies. */
  const cloneInput = (input: URL | RequestInfo): URL | RequestInfo =>
    input instanceof Request ? input.clone() : input;

  globalThis.fetch = async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await original(cloneInput(input), init);

        // Success or non‑429 → return, or out of retries
        if (res.status !== 429 || attempt >= maxRetries) {
          return res;
        }

        console.debug(
          `[fetch-retry] HTTP 429 response (attempt ${attempt + 1})`,
        );
      } catch (err) {
        // Snaps' polyfill may throw for 4xx/5xx. Detect "429" heuristically.
        const msg = String(err);
        const thrown429 =
          /(?:429|Too\s*Many\s*Requests)/i.test(msg) ||
          /ERR[_A-Z]*\s*429/i.test(msg);

        const isNetworkErr =
          err instanceof TypeError && /fetch/i.test(String(err));
        if (!(thrown429 || isNetworkErr) || attempt >= maxRetries) throw err;

        console.debug(
          `[fetch-retry] thrown 429 error (attempt ${attempt + 1})`,
        );
      }

      // Exponential back‑off with ±25 % jitter
      const delay = baseDelay * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, delay));
    }
  };

  (globalThis as any).__fetchPatched = true;
}

// Automatically patch fetch as a side‑effect when this module is imported.
patchFetch();
