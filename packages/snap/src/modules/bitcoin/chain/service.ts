import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import type {
  FeeRatio,
  IOnChainService,
  Balances,
  AssetBalances,
  TransactionIntent,
  Pagination,
  Fees,
  TransactionData,
} from '../../../chain';
import { compactError } from '../../../utils';
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

      const allowedAssets = new Set<string>(Object.values(BtcAsset));

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

  async estimateFees(): Promise<Fees> {
    try {
      const result = await this.readClient.getFeeRates();

      return {
        fees: Object.entries(result).map(
          ([key, value]: [key: FeeRatio, value: number]) => ({
            type: key,
            rate: value,
          }),
        ),
      };
    } catch (error) {
      throw new BtcOnChainServiceError(error);
    }
  }

  /* eslint-disable */
  listTransactions(address: string, pagination: Pagination) {
    throw new Error('Method not implemented.');
  }

  getTransaction(txnHash: string) {
    throw new Error('Method not implemented.');
  }
  /* eslint-disable */

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getDataForTransaction(
    address: string,
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData> {
    try {
      const data = await this.readClient.getUtxos(address);
      return {
        data: {
          utxos: data,
        },
      };
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }

  async boardcastTransaction(signedTransaction: string): Promise<string> {
    try {
      return await this.writeClient.sendTransaction(signedTransaction);
    } catch (error) {
      throw compactError(error, BtcOnChainServiceError);
    }
  }
}
