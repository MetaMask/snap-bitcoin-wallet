import type { FeeRate } from './constants';
import type { TransactionStatusData, Utxo } from './service';

export type DataClientGetBalancesResp = Record<string, number>;

export type DataClientGetUtxosResp = Utxo[];

export type DataClientGetFeeRatesResp = {
  [key in FeeRate]?: number;
};

export type DataClientGetTxStatusResp = TransactionStatusData;

export type DataClientSendTxResp = string;

/**
 * This interface defines the methods available on a data client for interacting with the Bitcoin blockchain.
 */
export type IDataClient = {
  /**
   * Gets the balances for a set of Bitcoin addresses.
   *
   * @param {string[]} addresses - An array of Bitcoin addresses to query.
   * @returns {Promise<DataClientGetBalancesResp>} A promise that resolves to a record of addresses and their corresponding balances.
   */
  getBalances(addresses: string[]): Promise<DataClientGetBalancesResp>;

  /**
   * Gets the UTXOs for a Bitcoin address.
   *
   * @param {string} address - The Bitcoin address to query.
   * @param {boolean} [includeUnconfirmed] - Whether or not to include unconfirmed UTXOs in the response. Defaults to false.
   * @returns {Promise<DataClientGetUtxosResp>} A promise that resolves to an array of UTXOs.
   */
  getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<DataClientGetUtxosResp>;

  /**
   * Gets the fee rates for the Bitcoin network.
   *
   * @returns {Promise<DataClientGetFeeRatesResp>} A promise that resolves to an object containing fee rates for different ratios.
   */
  getFeeRates(): Promise<DataClientGetFeeRatesResp>;

  /**
   * Gets the status of a transaction given its hash.
   *
   * @param {string} txHash - The hash of the transaction to query.
   * @returns {Promise<DataClientGetTxStatusResp>} A promise that resolves to the transaction status data.
   */
  getTransactionStatus(txHash: string): Promise<DataClientGetTxStatusResp>;

  /**
   * Sends a transaction to the Bitcoin network.
   *
   * @param {string} tx - The transaction to send.
   * @returns {Promise<DataClientSendTxResp>} A promise that resolves to the transaction hash.
   */
  sendTransaction(tx: string): Promise<DataClientSendTxResp>;
};
