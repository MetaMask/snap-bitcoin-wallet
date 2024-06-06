import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import type {
  FeeRatio,
  IOnChainService,
  AssetBalances,
  TransactionIntent,
  Fees,
  TransactionData,
  CommitedTransaction,
} from '../../chain';
import { compactError } from '../../utils';
import { BtcAsset } from '../constants';
import type { IWriteDataClient, IReadDataClient } from '../data-client';
import { BtcAmount } from '../wallet';
import { BtcOnChainServiceError } from './exceptions';

export type BtcOnChainServiceOptions = {
  network: Network;
};

export class BtcOnChainService implements IOnChainService {
  protected readonly _readClient: IReadDataClient;

  protected readonly _writeClient: IWriteDataClient;

  protected readonly _options: BtcOnChainServiceOptions;

  constructor(
    readClient: IReadDataClient,
    writeClient: IWriteDataClient,
    options: BtcOnChainServiceOptions,
  ) {
    this._readClient = readClient;
    this._writeClient = writeClient;
    this._options = options;
  }

  get network(): Network {
    return this._options.network;
  }

  async getBalances(
    addresses: string[],
    assets: string[],
  ): Promise<AssetBalances> {
    try {
      if (assets.length > 1) {
        throw new BtcOnChainServiceError('Only one asset is supported');
      }

      const allowedAssets = new Set<string>(Object.values(BtcAsset));

      if (
        !allowedAssets.has(assets[0]) ||
        (this.network === networks.testnet && assets[0] !== BtcAsset.TBtc) ||
        (this.network === networks.bitcoin && assets[0] !== BtcAsset.Btc)
      ) {
        throw new BtcOnChainServiceError('Invalid asset');
      }

      const balance = await this._readClient.getBalances(addresses);

      return addresses.reduce<AssetBalances>(
        (acc: AssetBalances, address: string) => {
          acc.balances[address] = {
            [assets[0]]: {
              amount: new BtcAmount(balance[address]),
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

  async getFeeRates(): Promise<Fees> {
    try {
      const result = await this._readClient.getFeeRates();

      return {
        fees: Object.entries(result).map(
          ([key, value]: [key: FeeRatio, value: number]) => ({
            type: key,
            rate: new BtcAmount(value),
          }),
        ),
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  async getTransactionStatus(txHash: string) {
    try {
      return await this._readClient.getTransactionStatus(txHash);
    } catch (error) {
      throw new BtcOnChainServiceError(error);
    }
  }

  async getDataForTransaction(
    address: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData> {
    try {
      const data = await this._readClient.getUtxos(address);
      return {
        data: {
          utxos: data,
        },
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  async broadcastTransaction(
    signedTransaction: string,
  ): Promise<CommitedTransaction> {
    try {
      const transactionId = await this._writeClient.sendTransaction(
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
