import { Chain, Config } from '../../config';
import { Network } from '../constants';
import { getExplorerUrl } from './explorer';

describe('getExplorerUrl', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  it('returns a bitcoin testnet explorer url', () => {
    const result = getExplorerUrl(address, Network.Testnet);
    expect(result).toBe(
      `${Config.explorer[Chain.Bitcoin][Network.Testnet]}/address/${address}`,
    );
  });

  it('returns a bitcoin mainnet explorer url', () => {
    const result = getExplorerUrl(address, Network.Mainnet);
    expect(result).toBe(
      `${Config.explorer[Chain.Bitcoin][Network.Mainnet]}/address/${address}`,
    );
  });

  it('throws `Invalid network` error if the given network is not support', () => {
    expect(() => getExplorerUrl(address, 'some invalid network')).toThrow(
      'Invalid network',
    );
  });
});
