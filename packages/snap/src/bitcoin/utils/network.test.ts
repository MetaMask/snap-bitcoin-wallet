import { networks } from 'bitcoinjs-lib';

import { Network } from '../constants';
import { getBtcNetwork, getCaip2ChainId } from './network';

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

describe('getCaip2ChainId', () => {
  it('returns CAIP-2 testnet chain ID of bitcoin', () => {
    const result = getCaip2ChainId(networks.testnet);
    expect(result).toStrictEqual(Network.Testnet);
  });

  it('returns CAIP-2 mainnet chain ID of bitcoin', () => {
    const result = getCaip2ChainId(networks.bitcoin);
    expect(result).toStrictEqual(Network.Mainnet);
  });

  it('throws `Invalid network` error if the given network is not support', () => {
    expect(() => getCaip2ChainId(networks.regtest)).toThrow('Invalid network');
  });
});
