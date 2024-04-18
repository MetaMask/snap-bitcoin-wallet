import { networks } from 'bitcoinjs-lib';

import { Network } from '../config';
import { NetworkHelper } from './helpers';

describe('NetworkHelper', () => {
  describe('getNetwork', () => {
    it('returns bitcoin testnet network', () => {
      const result = NetworkHelper.getNetwork(Network.Testnet);
      expect(result).toStrictEqual(networks.testnet);
    });

    it('returns bitcoin mainnet network', () => {
      const result = NetworkHelper.getNetwork(Network.Mainnet);
      expect(result).toStrictEqual(networks.bitcoin);
    });

    it('throws `Invalid network` error if the given network is not support', () => {
      expect(() =>
        NetworkHelper.getNetwork('someInvalidNetwork' as unknown as Network),
      ).toThrow('Invalid network');
    });
  });
});
