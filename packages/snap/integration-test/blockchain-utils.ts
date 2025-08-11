// eslint-disable-next-line import-x/no-nodejs-modules
import { execSync } from 'child_process';

/**
 * Minimal utility for Bitcoin regtest operations in integration tests
 */
export class BlockchainTestUtils {
  readonly #containerName: string;

  readonly #esploraHost: string;

  readonly #esploraPort: number;

  readonly #esploraBaseUrl: string;

  constructor(options?: {
    containerName?: string;
    esploraHost?: string;
    esploraPort?: number;
  }) {
    this.#containerName = options?.containerName ?? 'esplora';
    this.#esploraHost = options?.esploraHost ?? 'localhost';
    this.#esploraPort = options?.esploraPort ?? 8094;
    this.#esploraBaseUrl = `http://${this.#esploraHost}:${this.#esploraPort}/regtest/api`;
  }

  /**
   * Execute a bitcoin-cli command in the Docker container
   *
   * @param command - The bitcoin-cli command to execute
   * @returns The command output as a string
   */
  #execCli(command: string): string {
    const fullCommand = `docker exec ${this.#containerName} cli -regtest ${command}`;
    try {
      return execSync(fullCommand, { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error(
        `Failed to execute CLI command: ${command}\n${String(error)}`,
      );
    }
  }

  /**
   * Poll until Esplora has indexed up to a specific block height
   *
   * @param targetHeight - The block height to wait for
   * @param maxRetries - Maximum number of polling attempts
   */
  async #waitForEsploraHeight(
    targetHeight: number,
    maxRetries = 20,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.#esploraBaseUrl}/blocks/tip/height`,
        );
        if (response.ok) {
          const height = parseInt(await response.text(), 10);
          if (height >= targetHeight) {
            return;
          }
        }
      } catch {
        // Esplora not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      `Esplora did not reach height ${targetHeight} after ${maxRetries} attempts`,
    );
  }

  /**
   * Wait for Esplora to see a transaction
   *
   * @param txid - The transaction ID to wait for
   * @param maxRetries - Maximum number of polling attempts
   */
  async #waitForEsploraTx(txid: string, maxRetries = 20): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.#esploraBaseUrl}/tx/${txid}`);
        if (response.ok) {
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      `Esplora did not index transaction ${txid} after ${maxRetries} attempts`,
    );
  }

  /**
   * Send Bitcoin to an address and wait for Esplora to see it
   *
   * @param address - The Bitcoin address to send to
   * @param amount - The amount of BTC to send
   * @returns The transaction ID
   */
  async sendToAddress(address: string, amount: number): Promise<string> {
    const txid = this.#execCli(
      `-rpcwallet=default sendtoaddress "${address}" ${amount}`,
    );

    await this.#waitForEsploraTx(txid);
    return txid;
  }

  /**
   * Mine blocks and wait for Esplora to index them
   *
   * @param count - The number of blocks to mine
   */
  async mineBlocks(count: number): Promise<void> {
    const currentHeight = parseInt(this.#execCli('getblockcount'), 10);
    const targetHeight = currentHeight + count;

    const minerAddress = this.#execCli('getnewaddress');
    this.#execCli(`generatetoaddress ${count} ${minerAddress}`);

    await this.#waitForEsploraHeight(targetHeight);
  }
}
