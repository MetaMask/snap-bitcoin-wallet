import { networks } from 'bitcoinjs-lib';

import { Network } from '../constants';
import { getBtcNetwork } from './network';

describe('getBtcNetwork', () => {
  it('returns bitcoin testnet network', () => {
    const result = getBtcNetwork(Network.Testnet);
    expect(result).toStrictEqual(networks.testnet);
  });

  it('returns bitcoin mainnet network', () => {
    const result = getBtcNetwork(Network.Mainnet);
    expect(result).toStrictEqual(networks.bitcoin);
  });

  it('throws `Invalid network` error if the given network is not support', () => {
    expect(() =>
      getBtcNetwork('someInvalidNetwork' as unknown as Network),
    ).toThrow('Invalid network');
  });
});
