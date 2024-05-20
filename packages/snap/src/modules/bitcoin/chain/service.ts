import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { compactError } from '../../../utils';
import type {
  IOnChainService,
  Balances,
  AssetBalances,
  TransactionIntent,
  Pagination,
  Fees,
} from '../../chain/types';
import { BtcAsset } from '../constants';
import type { IWriteDataClient } from '../data-client';
import { type IReadDataClient } from '../data-client';
import { BtcOnChainServiceError } from './exceptions';
import type { BtcOnChainServiceOptions } from './types';

export class BtcOnChainService implements IOnChainService {
  protected readonly readClient: IReadDataClient;

  protected readonly writeClient: IWriteDataClient;

  protected readonly options: BtcOnChainServiceOptions;

  constructor(
    readClient: IReadDataClient,
    writeClient: IWriteDataClient,
    options: BtcOnChainServiceOptions,
  ) {
    this.readClient = readClient;
    this.writeClient = writeClient;
    this.options = options;
  }

  get network(): Network {
    return this.options.network;
  }

  async getBalances(
    addresses: string[],
    assets: string[],
  ): Promise<AssetBalances> {
    try {
      if (assets.length > 1) {
        throw new BtcOnChainServiceError('Only one asset is supported');
      }

      const allowedAssets = new Set<string>(
        Object.entries(BtcAsset).map(([_, value]) => value.toString()),
      );

      if (
        !allowedAssets.has(assets[0]) ||
        (this.network === networks.testnet && assets[0] !== BtcAsset.TBtc) ||
        (this.network === networks.bitcoin && assets[0] !== BtcAsset.Btc)
      ) {
        throw new BtcOnChainServiceError('Invalid asset');
      }

      const balance: Balances = await this.readClient.getBalances(addresses);

      return addresses.reduce<AssetBalances>(
        (acc: AssetBalances, address: string) => {
          acc.balances[address] = {
            [assets[0]]: {
              amount: balance[address],
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
  /* eslint-disable */
  async estimateFees(): Promise<Fees> {
    throw new Error('Method not implemented.');
  }

  listTransactions(address: string, pagination: Pagination) {
    throw new Error('Method not implemented.');
  }

  getTransaction(txnHash: string) {
    throw new Error('Method not implemented.');
  }

  getDataForTransaction(address: string, transactionIntent: TransactionIntent) {
    throw new Error('Method not implemented.');
  }
  /* eslint-disable */

  async boardcastTransaction(signedTransaction: string): Promise<string> {
    try {
      return await this.writeClient.sendTransaction(signedTransaction);
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }
}
