import { Network } from '../bitcoin/constants';
import { getExplorerUrl } from './explorer';

describe('getExplorerUrl', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  it('returns a testnet explorer url', () => {
    const result = getExplorerUrl(address, Network.Testnet);
    expect(result).toBe(`https://blockstream.info/testnet/address/${address}`);
  });

  it('returns a mainnet explorer url', () => {
    const result = getExplorerUrl(address, Network.Mainnet);
    expect(result).toBe(`https://blockstream.info/address/${address}`);
  });

  it('throws `Invalid scope` error if the given scope is not support', () => {
    expect(() => getExplorerUrl(address, 'some invalid scope')).toThrow(
      'Invalid scope',
    );
  });
});
