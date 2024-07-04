import { type Network } from 'bitcoinjs-lib';

import { type BtcOnChainServiceConfig } from '../config';
import { DataClient } from '../constants';
import { BlockChairClient } from './clients/blockchair';
import { BlockStreamClient } from './clients/blockstream';
import { DataClientError } from './exceptions';
import type { IReadDataClient, IWriteDataClient } from './types';

export class DataClientFactory {
  static createReadClient(
    config: BtcOnChainServiceConfig,
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

  static createWriteClient(
    config: BtcOnChainServiceConfig,
    network: Network,
  ): IWriteDataClient {
    const { type, options } = config.dataClient.write;
    switch (type) {
      case DataClient.BlockChair:
        return new BlockChairClient({
          network,
          apiKey: options?.apiKey?.toString(),
        });
      default:
        throw new DataClientError(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unsupported client type: ${config.dataClient.write.type}`,
        );
    }
  }
}
