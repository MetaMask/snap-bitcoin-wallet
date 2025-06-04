import type {
  FeeEstimates,
  Network,
  Transaction,
} from '@metamask/bitcoindevkit';
import { EsploraClient } from '@metamask/bitcoindevkit';

import type {
  BitcoinAccount,
  ChainConfig,
  BlockchainClient,
} from '../entities';

export class EsploraClientAdapter implements BlockchainClient {
  // Should be a Repository but we don't support custom networks so we can save in memory from config values
  readonly #clients: Record<Network, EsploraClient>;

  readonly #config: ChainConfig;

  private static fetchPatched = false;

  constructor(config: ChainConfig) {
    EsploraClientAdapter.patchFetch();

    this.#clients = {
      bitcoin: new EsploraClient(config.url.bitcoin),
      testnet: new EsploraClient(config.url.testnet),
      testnet4: new EsploraClient(config.url.testnet4),
      signet: new EsploraClient(config.url.signet),
      regtest: new EsploraClient(config.url.regtest),
    };

    this.#config = config;
  }

  async fullScan(account: BitcoinAccount): Promise<void> {
    const request = account.startFullScan();
    const update = await this.#clients[account.network].full_scan(
      request,
      this.#config.stopGap,
      this.#config.parallelRequests,
    );
    account.applyUpdate(update);
  }

  async sync(account: BitcoinAccount): Promise<void> {
    const request = account.startSync();
    const update = await this.#clients[account.network].sync(
      request,
      this.#config.parallelRequests,
    );
    account.applyUpdate(update);
  }

  async broadcast(network: Network, transaction: Transaction): Promise<void> {
    await this.#clients[network].broadcast(transaction);
  }

  async getFeeEstimates(network: Network): Promise<FeeEstimates> {
    return this.#clients[network].get_fee_estimates();
  }

  /**
   * Monkey‑patch `fetch` so every request automatically retries on HTTP 429
   * using exponential back‑off (baseDelay ms × 2^attempt, up to maxRetries).
   * This applies to BDK calls because they delegate to `fetch` in WASM builds.
   *
   * NOTE: For idempotent GETs this is safe; for POSTs BDK currently performs
   * only transaction broadcast (safe to retry).
   */
  private static patchFetch(maxRetries = 3, baseDelay = 500): void {
    if (this.fetchPatched) return;

    const originalFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = async (
      ...args: Parameters<typeof fetch>
    ): Promise<Response> => {
      for (let attempt = 0; ; attempt++) {
        const res = await originalFetch(...args);
        if (res.status !== 429 || attempt >= maxRetries) {
          return res;
        }

        console.log('inside 429 retry', args);

        // Exponential back‑off: 0.5s, 1s, 2s, ...
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
        // For requests with a consumed body you'd need to recreate the Request.
        // BDK's Esplora calls are GET/POST without streaming bodies, so safe.
      }
    };

    this.fetchPatched = true;
  }
}
