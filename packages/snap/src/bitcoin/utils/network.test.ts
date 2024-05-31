import { networks } from 'bitcoinjs-lib';

import { Network } from '../constants';
import { getBtcNetwork, getCaip2Network } from './network';

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

describe('getCaip2Network', () => {
  it('returns caip2 testnet network', () => {
    const result = getCaip2Network(networks.testnet);
    expect(result).toStrictEqual(Network.Testnet);
  });

  it('returns caip2 mainnet network', () => {
    const result = getCaip2Network(networks.bitcoin);
    expect(result).toStrictEqual(Network.Mainnet);
  });

  it('throws `Invalid network` error if the given network is not support', () => {
    expect(() => getCaip2Network(networks.regtest)).toThrow('Invalid network');
  });
});
