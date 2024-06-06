import type { Json } from '@metamask/snaps-sdk';

import type { IAmount } from './wallet';

export enum FeeRatio {
  Fast = 'fast',
  Medium = 'medium',
  Slow = 'slow',
}

export enum TransactionStatus {
  Confirmed = 'confirmed',
  Pending = 'pending',
  Failed = 'failed',
}

export type TransactionStatusData = {
  status: TransactionStatus;
};

export type Balance = {
  amount: IAmount;
};

export type AssetBalances = {
  balances: {
    [address: string]: {
      [asset: string]: Balance;
    };
  };
};

export type Fee = {
  type: FeeRatio;
  rate: IAmount;
};

export type Fees = {
  fees: Fee[];
};

export type TransactionIntent = {
  amounts: Record<string, number>;
  subtractFeeFrom: string[];
  replaceable: boolean;
};

export type TransactionData = {
  data: Record<string, Json>;
};

export type CommitedTransaction = {
  transactionId: string;
};

/**
 * An interface that defines methods for interacting with a blockchain network.
 */
export type IOnChainService = {
  /**
   * Gets the balances for multiple addresses and multiple assets.
   *
   * @param addresses - An array of addresses to fetch the balances for.
   * @param assets - An array of assets to fetch the balances of.
   * @returns A promise that resolves to an `AssetBalances` object.
   */
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;

  /**
   * Gets the fee rates of the network.
   *
   * @returns A promise that resolves to a `Fees` object.
   */
  getFeeRates(): Promise<Fees>;

  /**
   * Broadcasts a signed transaction on the blockchain network.
   *
   * @param signedTransaction - A signed transaction string.
   * @returns A promise that resolves to a `CommitedTransaction` object.
   */
  broadcastTransaction(signedTransaction: string): Promise<CommitedTransaction>;

  /**
   * Gets the status of a transaction with the given transaction hash.
   *
   * @param txHash - The transaction hash of the transaction to get the status of.
   * @returns A promise that resolves to a `TransactionStatusData` object.
   */
  getTransactionStatus(txHash: string): Promise<TransactionStatusData>;

  /**
   * Gets the required metadata to build a transaction for the given address and transaction intent.
   *
   * @param address - The address to build the transaction for.
   * @param transactionIntent - The transaction intent object containing the transaction inputs and outputs.
   * @returns A promise that resolves to a `TransactionData` object.
   */
  getDataForTransaction(
    address: string,
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData>;

  // TODO: Implement listTransactions in next phase
  listTransactions();
};
