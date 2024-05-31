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

export type Balances = Record<string, number>;

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

export type IOnChainService = {
  /**
   * A method to get the balances for multiple addresses and multipe assets.
   *
   * @param addresses - A array of the addresse to fetch.
   * @param type - A array of the asset to fetch.
   * @returns A promise that resolves to an AssetBalances object.
   */
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;

  /**
   * A method to get the fee rate of the network.
   *
   * @returns A promise that resolves to an Fees object.
   */
  getFeeRates(): Promise<Fees>;

  /**
   * A method to broadcast the transaction on chain.
   *
   * @param signedTransaction - An signed transaction string.
   * @returns A promise that resolves to an CommitedTransaction object.
   */
  broadcastTransaction(signedTransaction: string): Promise<CommitedTransaction>;

  /**
   * A method to fetch the transaction status.
   *
   * @param txnHash - An transaction hash.
   * @returns A promise that resolves to an TransactionStatusData object.
   */
  getTransactionStatus(txnHash: string): Promise<TransactionStatusData>;

  /**
   * A method to fetch the require metadata to build an transaction.
   *
   * @param address - A address string.
   * @param transactionIntent - An TransactionIntent Object.
   * @returns A promise that resolves to an TransactionData object.
   */
  getDataForTransaction(
    address: string,
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData>;

  // TODO: implement listTransactions
  listTransactions();
};
