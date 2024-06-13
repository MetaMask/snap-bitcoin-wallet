import { Caip2ChainId } from '../constants';
import { getExplorerUrl } from './explorer';

describe('getExplorerUrl', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  it('returns a testnet explorer url', () => {
    const result = getExplorerUrl(address, Caip2ChainId.Testnet);
    expect(result).toBe(`https://blockstream.info/testnet/address/${address}`);
  });

  it('returns a mainnet explorer url', () => {
    const result = getExplorerUrl(address, Caip2ChainId.Mainnet);
    expect(result).toBe(`https://blockstream.info/address/${address}`);
  });

  it('throws `Invalid Chain ID` error if the given Chain ID is not support', () => {
    expect(() => getExplorerUrl(address, 'some Chain ID')).toThrow(
      'Invalid Chain ID',
    );
  });
});
