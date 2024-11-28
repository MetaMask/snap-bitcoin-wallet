import ecc from '@bitcoinerlab/secp256k1';
import { BtcMethod } from '@metamask/keyring-api';
import { BIP32Factory, type BIP32Interface } from 'bip32';
import type { Network } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import ECPairFactory from 'ecpair';
import { v4 as uuidV4 } from 'uuid';

import { Caip2ChainId } from '../src/constants';
import quickNodeData from './fixtures/quicknode.json';
import simpleHashData from './fixtures/simplehash.json';

/* eslint-disable */

/**
 * Method to generate testing account.
 *
 * @param cnt - Number of accounts to generate.
 * @param addressPrefix - Prefix for the address.
 * @returns Array of generated accounts.
 */
export function generateAccounts(cnt = 1, addressPrefix = '') {
  const accounts: any[] = [];
  let baseAddress = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  baseAddress =
    addressPrefix + baseAddress.slice(addressPrefix.length, baseAddress.length);

  for (let i = 0; i < cnt; i++) {
    accounts.push({
      type: 'bip122:p2wpkh',
      id: uuidV4(),
      address:
        baseAddress.slice(0, baseAddress.length - i.toString().length) +
        i.toString(),
      options: {
        scope: Caip2ChainId.Testnet,
        index: i,
      },
      methods: [`${BtcMethod.SendBitcoin}`],
    });
  }

  return accounts;
}

/**
 * Method to generate random bip32 deriver.
 *
 * @param network - Bitcoin network.
 * @param path - Derived path.
 * @param curve - Curve.
 * @returns An Json data and the bip32 deriver.
 */
export function createRandomBip32Data(
  network: Network,
  path: string[],
  curve: string,
) {
  const ECPair = ECPairFactory(ecc);
  const bip32 = BIP32Factory(ecc);

  const key = `${path.join('')}${curve}`;
  const hexStr = Buffer.from(key, 'utf8').toString('hex');
  const bufferHex = Buffer.from(hexStr, 'hex');

  const customRandomBufferFunc = (size: number): Buffer => {
    const byteBuffer32 = Buffer.alloc(size);
    bufferHex.copy(byteBuffer32);
    return byteBuffer32;
  };

  const keyPair = ECPair.makeRandom({
    network,
    rng: customRandomBufferFunc,
  });

  const deriver = bip32.fromSeed(keyPair.publicKey, network);

  const data = {
    privateKey: deriver.privateKey?.toString('hex'),
    publicKey: deriver.publicKey.toString('hex'),
    chainCode: deriver.chainCode.toString('hex'),
    depth: deriver.depth,
    index: deriver.index,
    curve,
    masterFingerprint: undefined,
    parentFingerprint: 0,
    chainCodeBytes: deriver.chainCode,
    privateKeyBytes: deriver.privateKey,
    publicKeyBytes: deriver.publicKey,
  };

  return {
    deriver,
    data,
  };
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
 * Generate QuickNode bb_getaddress response by address.
 *
 * @param address - The account address.
 * @returns A QuickNode bb_getaddress response.
 */
export function generateQuickNodeGetBalanceResp(address: string) {
  const template = quickNodeData.bb_getaddressResp;
  const data: typeof template = {
    ...template,
    result: {
      ...template.result,
      address: address,
      balance: randomNum(1000000).toString(),
    },
  };

  return data;
}

/**
 * Generate QuickNode bb_getutxos response.
 *
 * @param params - The params to generate mock utxos.
 * @param params.utxosCount - The utxos count.
 * @param params.minAmount - The min amount of each utxo value.
 * @param params.maxAmount - The max amount of each utxo value.
 * @param params.minConfirmations - The min confirmation of each utxo.
 * @param params.maxConfirmations - The max confirmation of each utxo.
 * @returns A QuickNode bb_getutxos response.
 */
export function generateQuickNodeGetUtxosResp({
  utxosCount,
  minAmount = 0,
  maxAmount = 1000000,
  minConfirmations = 1000,
  maxConfirmations = 10000,
}: {
  utxosCount: number;
  minAmount?: number;
  maxAmount?: number;
  minConfirmations?: number;
  maxConfirmations?: number;
}) {
  const template = quickNodeData.bb_getutxosResp;
  const data = { ...template };
  data.result = Array.from({ length: utxosCount }, (_, idx) => {
    return {
      txid: generateRandomTransactionId(),
      vout: idx,
      value: Math.max(minAmount, randomNum(maxAmount)).toString(),
      height: 100000 + idx,
      confirmations: Math.max(minConfirmations, randomNum(maxConfirmations)),
    };
  });
  return data;
}

/**
 * Generate QuickNode get rawtransaction response.
 *
 * @param params - The params to generate mock get rawtransaction response.
 * @param params.txid - The transaction id of the transaction.
 * @param params.confirmations - The number of confirmations of the transaction.
 * @returns A QuickNode get rawtransaction response.
 */
export function generateQuickNodeGetRawTransactionResp({
  txid,
  confirmations,
}: {
  txid: string;
  confirmations: number | undefined;
}) {
  const template = quickNodeData.getrawtransactionResp;
  const data = {
    ...template,
    result: {
      ...template.result,
      txid,
      confirmations: confirmations,
    },
  };
  return data;
}

/**
 * Generate QuickNode estimate smartfee response.
 *
 * @param params - The params to generate mock estimate smartfee response.
 * @param params.feerate - The fee rate in btc unit.
 * @returns A QuickNode estimate smartfee response.
 */
export function generateQuickNodeEstimatefeeResp({
  feerate,
}: {
  feerate: number | undefined;
}) {
  const template = quickNodeData.estimatesmartfeeResp;
  const data = {
    ...template,
    result: {
      ...template.result,
      feerate,
      block: Math.max(1000, randomNum(100000)),
    },
  };
  return data;
}

/**
 * Generate QuickNode get mempool info response.
 *
 * @param params - The params to generate mock get mempool info response.
 * @param params.mempoolminfee - Minimum fee rate in BTC/kvB for tx to be accepted.
 * @param params.minrelaytxfee - Minimum relay fee in BTC/kB for transactions.
 * @returns A QuickNode get mempool info response.
 */
export function generateQuickNodeMempoolResp({
  mempoolminfee = Math.max(1000, randomNum(10000)),
  minrelaytxfee,
}: {
  mempoolminfee?: number;
  minrelaytxfee?: number;
}) {
  const template = quickNodeData.getmempoolinfo;
  const data = {
    ...template,
    result: {
      ...template.result,
      mempoolminfee: mempoolminfee,
      minrelaytxfee: minrelaytxfee ?? Math.max(mempoolminfee, randomNum(10000)),
    },
  };
  return data;
}

/**
 * Generate QuickNode send rawtransaction response.
 *
 * @returns A QuickNode send rawtransaction response.
 */
export function generateQuickNodeSendRawTransactionResp() {
  const template = quickNodeData.estimatesmartfeeResp;
  const data = {
    ...template,
    result: generateRandomTransactionId(),
  };
  return data;
}

/**
 * Generate SimpleHash wallet_assets_by_utxo response.
 *
 * @param count - The number of utxo to generate.
 * @returns A SimpleHash wallet_assets_by_utxo response.
 */
export function generateSimpleHashWalletAssetsByAddressResp(
  address: string,
  count: number,
) {
  const template = simpleHashData.walletAssetsByAddress;
  const utxos = Array.from({ length: count }, (idx: number) => {
    return {
      output: `${generateTransactionId(Number(address) + idx)}:${randomNum(
        100,
      )}`,
      value: randomNum(1000000),
      block_number: randomNum(1000000),
    };
  });

  return {
    ...template,
    utxos,
    count: utxos.length,
  };
}

/**
 * Generate a 64 long hex transaction id.
 *
 * @returns A 64 long hex transaction id.
 */
export function generateTransactionId(id: number) {
  return id.toString(16).padStart(64, '0');
}

/**
 * Generate a random 64 long hex transaction id.
 *
 * @returns A 64 long hex transaction id.
 */
export function generateRandomTransactionId() {
  return generateTransactionId(randomNum(100000000));
}

/**
 * Method to generate formatted utxos with QuickNode resp.
 *
 * @param _address - the utxos owner address (deprecated).
 * @param utxosCount - count of the utxo to be generated.
 * @param minAmount - min amount of the utxo array.
 * @param maxAmount - max amount of the utxo array.
 * @returns An formatted utxo array.
 */
export function generateFormattedUtxos(
  _address: string,
  utxosCount: number,
  minAmount?: number,
  maxAmount?: number,
) {
  return generateQuickNodeGetUtxosResp({
    utxosCount,
    minAmount,
    maxAmount,
  }).result.map((utxo) => ({
    block: utxo.height,
    txHash: utxo.txid,
    index: utxo.vout,
    value: parseInt(utxo.value, 10),
  }));
}

/* eslint-disable */
