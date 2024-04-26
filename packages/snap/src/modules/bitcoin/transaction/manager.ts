import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { compactError } from '../../../utils';
import type {
  ITransactionMgr,
  Balances,
  AssetBalances,
} from '../../transaction/types';
import { BtcAsset } from '../constants';
import { type IReadDataClient } from '../data-client';
import { TransactionMgrError } from './exceptions';
import type { BtcTransactionMgrOptions } from './types';

export class BtcTransactionMgr implements ITransactionMgr {
  protected readonly readClient: IReadDataClient;

  protected readonly options: BtcTransactionMgrOptions;

  constructor(readClient: IReadDataClient, options: BtcTransactionMgrOptions) {
    this.readClient = readClient;
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
        throw new TransactionMgrError('Only one asset is supported');
      }

      const allowedAssets = new Set<string>(
        Object.entries(BtcAsset).map(([_, value]) => value.toString()),
      );

      if (
        !allowedAssets.has(assets[0]) ||
        (this.network === networks.testnet && assets[0] !== BtcAsset.TBtc) ||
        (this.network === networks.bitcoin && assets[0] !== BtcAsset.Btc)
      ) {
        throw new TransactionMgrError('Invalid asset');
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
      throw compactError(error, TransactionMgrError);
    }
  }
}
