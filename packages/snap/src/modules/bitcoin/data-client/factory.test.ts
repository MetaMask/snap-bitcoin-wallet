import { networks } from 'bitcoinjs-lib';

import { DataClient } from '../config';
import { BlockStreamClient } from './clients/blockstream';
import { DataClientFactory } from './factory';

describe('DataClientFactory', () => {
  describe('createReadClient', () => {
    it('creates BlockStreamClient', () => {
      const instance = DataClientFactory.createReadClient(
        { dataClient: { read: { type: DataClient.BlockStream } } },
        networks.testnet,
      );

      expect(instance).toBeInstanceOf(BlockStreamClient);
    });

    it('throws `Unsupported client type` if the given client is not support', () => {
      expect(() =>
        DataClientFactory.createReadClient(
          { dataClient: { read: { type: DataClient.BlockChair } } },
          networks.testnet,
        ),
      ).toThrow('Unsupported client type: BlockChair');
    });
  });
});
