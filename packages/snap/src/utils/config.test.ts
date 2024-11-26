import { networks } from 'bitcoinjs-lib';

import { Config } from '../config';
import { isSatsProtectionEnabled } from './config';

describe('isSatsProtectionEnabled', () => {
  const { defaultSatsProtectionEnabled } = Config;

  afterEach(() => {
    Config.defaultSatsProtectionEnabled = defaultSatsProtectionEnabled;
  });

  it.each([
    {
      network: networks.bitcoin,
      networkName: 'mainnet',
      satsProtection: true,
      expected: true,
    },
    {
      network: networks.bitcoin,
      networkName: 'mainnet',
      satsProtection: false,
      expected: false,
    },
    {
      network: networks.testnet,
      networkName: 'testnet',
      satsProtection: false,
      expected: false,
    },
    {
      network: networks.testnet,
      networkName: 'testnet',
      satsProtection: false,
      expected: false,
    },
  ])(
    'return $expected when: satsProtection - $satsProtection, network - $networkName',
    async ({ network, satsProtection, expected }) => {
      Config.defaultSatsProtectionEnabled = satsProtection;

      expect(isSatsProtectionEnabled(network)).toBe(expected);
    },
  );
});
