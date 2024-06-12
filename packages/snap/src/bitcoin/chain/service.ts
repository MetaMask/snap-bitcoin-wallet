import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { Caip2Asset } from '../../constants';
import { compactError } from '../../utils';
import type { FeeRatio, TransactionStatus } from './constants';
import type { IDataClient } from './data-client';
import { BtcOnChainServiceError } from './exceptions';

export type TransactionStatusData = {
  status: TransactionStatus;
};

export type Balance = {
  amount: bigint;
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
  rate: bigint;
};

export type Fees = {
  fees: {
    type: FeeRatio;
    rate: bigint;
  }[];
};

export type Utxo = {
  block: number;
  txHash: string;
  index: number;
  value: number;
};

export type TransactionData = {
  data: {
    utxos: Utxo[];
  };
};

export type CommitedTransaction = {
  transactionId: string;
};

export type BtcOnChainServiceOptions = {
  network: Network;
};

export class BtcOnChainService {
  protected readonly _dataClient: IDataClient;

  protected readonly _options: BtcOnChainServiceOptions;

  constructor(dataClient: IDataClient, options: BtcOnChainServiceOptions) {
    this._dataClient = dataClient;
    this._options = options;
  }

  get network(): Network {
    return this._options.network;
  }

  /**
   * Gets the balances for multiple addresses and multiple assets.
   *
   * @param addresses - An array of addresses to fetch the balances for.
   * @param assets - An array of assets to fetch the balances of.
   * @returns A promise that resolves to an `AssetBalances` object.
   */
  async getBalances(
    addresses: string[],
    assets: string[],
  ): Promise<AssetBalances> {
    try {
      if (assets.length > 1) {
        throw new BtcOnChainServiceError('Only one asset is supported');
      }

      const allowedAssets = new Set<string>(Object.values(Caip2Asset));

      if (
        !allowedAssets.has(assets[0]) ||
        (this.network === networks.testnet && assets[0] !== Caip2Asset.TBtc) ||
        (this.network === networks.bitcoin && assets[0] !== Caip2Asset.Btc)
      ) {
        throw new BtcOnChainServiceError('Invalid asset');
      }

      const balance = await this._dataClient.getBalances(addresses);

      return addresses.reduce<AssetBalances>(
        (acc: AssetBalances, address: string) => {
          acc.balances[address] = {
            [assets[0]]: {
              amount: BigInt(balance[address]),
            },
          };
          return acc;
        },
        { balances: {} },
      );
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  /**
   * Gets the fee rates of the network.
   *
   * @returns A promise that resolves to a `Fees` object.
   */
  async getFeeRates(): Promise<Fees> {
    try {
      const result = await this._dataClient.getFeeRates();

      return {
        fees: Object.entries(result).map(
          ([key, value]: [key: FeeRatio, value: number]) => ({
            type: key,
            rate: BigInt(value),
          }),
        ),
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  /**
   * Gets the status of a transaction with the given transaction hash.
   *
   * @param txHash - The transaction hash of the transaction to get the status of.
   * @returns A promise that resolves to a `TransactionStatusData` object.
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatusData> {
    try {
      return await this._dataClient.getTransactionStatus(txHash);
    } catch (error) {
      throw new BtcOnChainServiceError(error);
    }
  }

  /**
   * Gets the required metadata to build a transaction for the given address and transaction intent.
   *
   * @param address - The address to build the transaction for.
   * @returns A promise that resolves to a `TransactionData` object.
   */
  async getDataForTransaction(address: string): Promise<TransactionData> {
    try {
      const data = await this._dataClient.getUtxos(address);
      return {
        data: {
          utxos: data,
        },
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  /**
   * Broadcasts a signed transaction on the blockchain network.
   *
   * @param signedTransaction - A signed transaction string.
   * @returns A promise that resolves to a `CommitedTransaction` object.
   */
  async broadcastTransaction(
    signedTransaction: string,
  ): Promise<CommitedTransaction> {
    try {
      const transactionId = await this._dataClient.sendTransaction(
        signedTransaction,
      );
      return {
        transactionId,
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  listTransactions() {
    throw new Error('Method not implemented.');
  }
}
