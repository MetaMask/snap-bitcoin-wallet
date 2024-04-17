import { type Network } from 'bitcoinjs-lib';

import { DataClient, type BtcTransactionConfig } from '../config';
import { BlockStreamClient } from './clients/blockstream';
import { DataClientError } from './exceptions';
import type { IReadDataClient } from './types';

export class DataClientFactory {
  static createReadClient(
    config: BtcTransactionConfig,
    network: Network,
  ): IReadDataClient {
    switch (config.dataClient.read.type) {
      case DataClient.BlockStream:
        return new BlockStreamClient({ network });
      default:
        throw new DataClientError(
          `Unsupported client type: ${config.dataClient.read.type}`,
        );
    }
  }
}
