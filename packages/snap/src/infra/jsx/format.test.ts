import { displayOrigin } from './format';

/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Amount: {
    from_sat: jest.fn(),
  },
  BdkErrorCode: {},
}));
/* eslint-enable @typescript-eslint/naming-convention */

describe('displayOrigin', () => {
  it('returns the known label for the internal "metamask" origin', () => {
    expect(displayOrigin('metamask')).toBe('MetaMask');
  });

  it('returns the known label for the "wallet-connect" origin', () => {
    expect(displayOrigin('wallet-connect')).toBe('WalletConnect');
  });

  it('matches known origins case-insensitively', () => {
    expect(displayOrigin('MetaMask')).toBe('MetaMask');
    expect(displayOrigin('Wallet-Connect')).toBe('WalletConnect');
  });

  it('returns the hostname for a valid https URL', () => {
    expect(displayOrigin('https://app.uniswap.org')).toBe('app.uniswap.org');
  });

  it('returns the hostname for a valid http URL', () => {
    expect(displayOrigin('http://localhost:8080')).toBe('localhost');
  });

  it('returns an empty string for a non-http(s) URL', () => {
    expect(displayOrigin('ftp://example.com')).toBe('');
  });

  it('returns an empty string for a WalletConnect channelId', () => {
    expect(
      displayOrigin(
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      ),
    ).toBe('');
  });

  it('returns an empty string for an invalid origin', () => {
    expect(displayOrigin('not a url')).toBe('');
    expect(displayOrigin('')).toBe('');
  });
});
