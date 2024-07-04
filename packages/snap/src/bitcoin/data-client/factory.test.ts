import { networks } from 'bitcoinjs-lib';

import { DataClient } from '../constants';
import { BlockChairClient } from './clients/blockchair';
import { BlockStreamClient } from './clients/blockstream';
import { DataClientFactory } from './factory';

describe('DataClientFactory', () => {
  describe('createReadClient', () => {
    it('creates BlockStreamClient', () => {
      const instance = DataClientFactory.createReadClient(
        {
          dataClient: {
            read: { type: DataClient.BlockStream },
            write: { type: DataClient.BlockChair },
          },
        },
        networks.testnet,
      );

      expect(instance).toBeInstanceOf(BlockStreamClient);
    });

    it('creates BlockChairClient', () => {
      const instance = DataClientFactory.createReadClient(
        {
          dataClient: {
            read: { type: DataClient.BlockChair },
            write: { type: DataClient.BlockChair },
          },
        },
        networks.testnet,
      );

      expect(instance).toBeInstanceOf(BlockChairClient);
    });

    it('throws `Unsupported client type` if the given client is not support', () => {
      expect(() =>
        DataClientFactory.createReadClient(
          {
            dataClient: {
              read: { type: 'SomeClient' as unknown as DataClient },
              write: { type: DataClient.BlockChair },
            },
          },
          networks.testnet,
        ),
      ).toThrow('Unsupported client type: SomeClient');
    });
  });

  describe('createWriteClient', () => {
    it('creates BlockChairClient', () => {
      const instance = DataClientFactory.createWriteClient(
        {
          dataClient: {
            read: { type: DataClient.BlockChair },
            write: { type: DataClient.BlockChair },
          },
        },
        networks.testnet,
      );

      expect(instance).toBeInstanceOf(BlockChairClient);
    });

    it('throws `Unsupported client type` if the given client is not support', () => {
      expect(() =>
        DataClientFactory.createWriteClient(
          {
            dataClient: {
              read: { type: DataClient.BlockChair },
              write: { type: 'SomeClient' as unknown as DataClient },
            },
          },
          networks.testnet,
        ),
      ).toThrow('Unsupported client type: SomeClient');
    });
  });
});
