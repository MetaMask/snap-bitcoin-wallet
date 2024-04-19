import type { BIP32Interface } from 'bip32';
import type { Network } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import blockChairData from './fixtures/blockchair.json';
import blockStreamData from './fixtures/blockstream.json';

/**
 * Method to generate testing account.
 *
 * @param cnt - Number of accounts to generate.
 * @param addressPrefix - Prefix for the address.
 * @param idPrefix - Prefix for the id.
 * @returns Array of generated accounts.
 */
export function generateAccounts(cnt = 1, addressPrefix = '', idPrefix = '') {
  const accounts: any[] = [];
  let baseAddress = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';
  let baseUUID = '1b9d6bcd-bbfd-4b2d-9b5d-abadfbbdcbed';

  baseAddress =
    addressPrefix + baseAddress.slice(addressPrefix.length, baseAddress.length);
  baseUUID = idPrefix + baseUUID.slice(idPrefix.length, baseUUID.length);

  for (let i = 0; i < cnt; i++) {
    const hdPath = [`m`, `0'`, `0`, `${i}`].join('/');
    accounts.push({
      type: 'bip122:p2wpkh',
      id:
        baseUUID.slice(0, baseUUID.length - i.toString().length) + i.toString(),
      address:
        baseAddress.slice(0, baseAddress.length - i.toString().length) +
        i.toString(),
      options: {
        hdPath,
        index: i,
      },
      methods: ['chain_getBalances'],
    });
  }

  return accounts;
}

/**
 * Method to generate mock bip32 instance.
 *
 * @param network - Bitcoin network.
 * @param idx - Index of the bip32 instance.
 * @param depth - Depth of the bip32 instance.
 * @returns An BIP32Interface instance and spys.
 */
export function createMockBip32Instance(
  network: Network,
  idx = 0,
  depth = 0,
): {
  instance: BIP32Interface;
  isNeuteredSpy: jest.Mock;
  neuteredSpy: jest.Mock;
  toBase58Spy: jest.Mock;
  toWIFSpy: jest.Mock;
  deriveSpy: jest.Mock;
  deriveHardenedSpy: jest.Mock;
  derivePathSpy: jest.Mock;
  tweakSpy: jest.Mock;
  signSpy: jest.Mock;
  verifySpy: jest.Mock;
} {
  const deriveHardenedSpy = jest.fn();
  const deriveSpy = jest.fn();
  const derivePathSpy = jest.fn();
  const tweakSpy = jest.fn();
  const isNeuteredSpy = jest.fn();
  const neuteredSpy = jest.fn();
  const toBase58Spy = jest.fn();
  const toWIFSpy = jest.fn();
  const signSpy = jest.fn();
  const verifySpy = jest.fn();

  class MockBIP32Interface implements BIP32Interface {
    fingerprint = Buffer.from('dddddddd', 'hex');

    publicKey = Buffer.from('dddddddd', 'hex');

    chainCodeBytes = Buffer.from('dddddddd', 'hex');

    publicKeyBytes = Buffer.from('dddddddd', 'hex');

    privateKey = Buffer.from('dddddddd', 'hex');

    identifier = Buffer.from('dddddddd', 'hex');

    chainCode = Buffer.from('dddddddd', 'hex');

    network = network;

    depth = depth;

    index = idx;

    parentFingerprint = 12345;

    isNeutered = isNeuteredSpy.mockReturnValue(false);

    neutered = neuteredSpy.mockImplementation(() => new MockBIP32Interface());

    toBase58 = toBase58Spy.mockReturnValue('dddddddd');

    toWIF = toWIFSpy.mockReturnValue('dddddddd');

    derive = deriveSpy.mockImplementation(() => new MockBIP32Interface());

    deriveHardened = deriveHardenedSpy.mockImplementation(
      () => new MockBIP32Interface(),
    );

    derivePath = derivePathSpy.mockImplementation(
      () => new MockBIP32Interface(),
    );

    tweak = tweakSpy;

    lowR = false;

    sign = signSpy;

    verify = verifySpy;

    signSchnorr = jest.fn();

    verifySchnorr = jest.fn();
  }

  return {
    instance: new MockBIP32Interface(),
    isNeuteredSpy,
    neuteredSpy,
    toBase58Spy,
    toWIFSpy,
    deriveSpy,
    deriveHardenedSpy,
    derivePathSpy,
    tweakSpy,
    signSpy,
    verifySpy,
  };
}

const randomNum = (max) => Math.floor(Math.random() * max);
/**
 * Method to generate blockstream account stats resp by addresses.
 *
 * @param addresses - Array of address in string.
 * @returns An array of blocksteam stats response.
 */
export function generateBlockStreamAccountStats(addresses: string[]) {
  const template = blockStreamData.getAccountStatsResp;
  const resp: (typeof template)[] = [];
  for (const address of addresses) {
    /* eslint-disable */
    resp.push({
      ...template,
      address,
      chain_stats: {
        funded_txo_count: randomNum(100),
        funded_txo_sum: Math.max(randomNum(1000000), 10000),
        spent_txo_count: randomNum(100),
        spent_txo_sum: randomNum(10000),
        tx_count: randomNum(100),
      },
      mempool_stats: {
        funded_txo_count: randomNum(100),
        funded_txo_sum: Math.max(randomNum(1000000), 10000),
        spent_txo_count: randomNum(100),
        spent_txo_sum: randomNum(10000),
        tx_count: randomNum(100),
      },
    });
    /* eslint-disable */
  }
  return resp;
}

/**
 * Method to generate blockchair getBalance resp by addresses.
 *
 * @param addresses - Array of address in string.
 * @returns An array of blockchair getBalance response.
 */
export function generateBlockChairGetBalanceResp(addresses: string[]) {
  const template = blockChairData.getBalanceResp;
  const resp: typeof template = { ...template, data: {} };
  for (const address of addresses) {
    resp.data[address] = randomNum(1000000);
  }
  return resp;
}
