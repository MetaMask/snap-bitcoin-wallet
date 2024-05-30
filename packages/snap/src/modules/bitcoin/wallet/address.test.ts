import { networks } from 'bitcoinjs-lib';

import { Network } from '../constants';
import { getExplorerUrl } from '../utils';
import { BtcAddress } from './address';

describe('BtcAddress', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  describe('toString', () => {
    it('returns a address', async () => {
      const network = networks.testnet;
      const val = new BtcAddress(address, network);
      expect(val.toString()).toStrictEqual(address);
    });

    it('returns a shortern address', async () => {
      const network = networks.testnet;
      const val = new BtcAddress(address, network);
      expect(val.toString(true)).toBe('tb1qt...aeu');
    });
  });

  describe('toJson', () => {
    it('returns a json', async () => {
      const network = networks.testnet;
      const val = new BtcAddress(address, network);
      expect(val.toJson()).toStrictEqual({
        address: val.toString(true),
        rawAddress: val.toString(false),
        explorerUrl: val.explorerUrl,
      });
    });
  });

  describe('valueOf', () => {
    it('returns a value', async () => {
      const network = networks.testnet;
      const val = new BtcAddress(address, network);
      expect(val.valueOf()).toStrictEqual(val.address);
    });
  });

  describe('explorerUrl', () => {
    it('returns a testnet explorerUrl', async () => {
      const network = networks.testnet;
      const val = new BtcAddress(address, network);
      expect(val.explorerUrl).toStrictEqual(
        getExplorerUrl(address, Network.Testnet),
      );
    });

    it('returns a mainnet explorerUrl', async () => {
      const network = networks.bitcoin;
      const val = new BtcAddress(address, network);
      expect(val.explorerUrl).toStrictEqual(
        getExplorerUrl(address, Network.Mainnet),
      );
    });
  });
});
