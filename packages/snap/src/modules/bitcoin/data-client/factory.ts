import { type Network } from 'bitcoinjs-lib';

import { type BtcTransactionConfig } from '../config';
import { DataClient } from '../constants';
import { BlockChairClient } from './clients/blockchair';
import { BlockStreamClient } from './clients/blockstream';
import { DataClientError } from './exceptions';
import type { IReadDataClient } from './types';

export class DataClientFactory {
  static createReadClient(
    config: BtcTransactionConfig,
    network: Network,
  ): IReadDataClient {
    const { type, options } = config.dataClient.read;
    switch (type) {
      case DataClient.BlockStream:
        return new BlockStreamClient({ network });
      case DataClient.BlockChair:
        return new BlockChairClient({
          network,
          apiKey: options?.apiKey?.toString(),
        });
      default:
        throw new DataClientError(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unsupported client type: ${config.dataClient.read.type}`,
        );
    }
  }
}
