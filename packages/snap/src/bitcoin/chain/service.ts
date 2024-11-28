import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { Caip19Asset } from '../../constants';
import { compactError } from '../../utils';
import { isSatsProtectionEnabled } from '../../utils/config';
import type { FeeRate, TransactionStatus } from './constants';
import type { IDataClient, ISatsProtectionDataClient } from './data-client';
import { BtcOnChainServiceError } from './exceptions';

export type TransactionStatusData = {
  status: TransactionStatus;
};

export type Balance = {
  amount: bigint;
};

export type AssetBalances = {
  balances: {
    [asset: string]: Balance;
  };
};

export type Fee = {
  type: FeeRate;
  rate: bigint;
};

export type Fees = {
  fees: Fee[];
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

export type CommittedTransaction = {
  transactionId: string;
};

export type BtcOnChainServiceOptions = {
  network: Network;
};

export type BtcOnChainServiceClients = {
  dataClient: IDataClient;
  satsProtectionDataClient: ISatsProtectionDataClient;
};

export class BtcOnChainService {
  protected readonly _dataClient: IDataClient;

  protected readonly _satsProtectionDataClient: ISatsProtectionDataClient;

  protected readonly _options: BtcOnChainServiceOptions;

  constructor(
    { dataClient, satsProtectionDataClient }: BtcOnChainServiceClients,
    options: BtcOnChainServiceOptions,
  ) {
    this._dataClient = dataClient;
    this._satsProtectionDataClient = satsProtectionDataClient;
    this._options = options;
  }

  get network(): Network {
    return this._options.network;
  }

  /**
   * Gets the BTC balances from addresses.
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

      const asset = assets[0];

      if (
        (this.network === networks.testnet && asset !== Caip19Asset.TBtc) ||
        (this.network === networks.bitcoin && asset !== Caip19Asset.Btc)
      ) {
        throw new BtcOnChainServiceError('Invalid asset');
      }

      const balance = await this.getSpendableBalance(addresses);

      return {
        balances: {
          [asset]: {
            amount: balance,
          },
        },
      };
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
          ([key, value]: [key: FeeRate, value: number]) => ({
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
   * Gets the required metadata to build a transaction for the given addresses and transaction intent.
   *
   * @param addresses - The addresses to build the transaction for.
   * @returns A promise that resolves to a `TransactionData` object.
   */
  async getDataForTransaction(addresses: string[]): Promise<TransactionData> {
    try {
      return {
        data: {
          utxos: await this.getSpendableUtxos(addresses),
        },
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  /**
   * Get the spendable UTXOs that does not contains Inscription, Runes or Rare Sats.
   *
   * @param addresses - An array of Bitcoin addresses to query.
   * @returns A promise that resolves to the filtered UTXOs.
   */
  protected async getSpendableUtxos(addresses: string[]): Promise<Utxo[]> {
    if (this.isSatsProtectionEnabled()) {
      // FIXME: SimpleHash provider does return the filtered UTXOs directly,
      // so it is not necessary to give the list of UTXOs to filter (hence the `[]`).
      // This logic may change if we change our provider.
      return await this._satsProtectionDataClient.filterUtxos(addresses, []);
    }
    return await this._dataClient.getUtxos(addresses);
  }

  /**
   * Get the spendable balance that does not contain Inscription, Runes or Rare Sats.
   *
   * @param addresses - An array of Bitcoin addresses to query.
   * @returns A promise that resolves to the spendable BTC balance.
   */
  protected async getSpendableBalance(addresses: string[]): Promise<bigint> {
    if (this.isSatsProtectionEnabled()) {
      // There is no API to get the spendable balance directly, so
      // we need to get the spendable UTXOs and sum the values.
      const utxos = await this.getSpendableUtxos(addresses);
      return utxos.reduce((acc, utxo) => acc + BigInt(utxo.value), BigInt(0));
    }

    const balances = await this._dataClient.getBalances(addresses);
    return Object.values(balances).reduce(
      (acc, balance) => acc + BigInt(balance),
      BigInt(0),
    );
  }

  protected isSatsProtectionEnabled(): boolean {
    return isSatsProtectionEnabled(this.network);
  }

  /**
   * Broadcasts a signed transaction on the blockchain network.
   *
   * @param signedTransaction - A signed transaction string.
   * @returns A promise that resolves to a `CommittedTransaction` object.
   */
  async broadcastTransaction(
    signedTransaction: string,
  ): Promise<CommittedTransaction> {
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
