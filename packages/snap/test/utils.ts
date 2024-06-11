import ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory, type BIP32Interface } from 'bip32';
import type { Network } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import ECPairFactory from 'ecpair';
import { v4 as uuidv4 } from 'uuid';

import { Network as NetworkEnum } from '../src/bitcoin/constants';
import blockChairData from './fixtures/blockchair.json';

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
      id: uuidv4(),
      address:
        baseAddress.slice(0, baseAddress.length - i.toString().length) +
        i.toString(),
      options: {
        scope: NetworkEnum.Testnet,
        index: i,
      },
      methods: ['btc_sendmany'],
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

/**
 * Method to generate blockchair getUtxos resp by address.
 *
 * @param address - address in string.
 * @param utxosCount - utxos count.
 * @param minAmount - min amount of each utxo value.
 * @param maxAmount - max amount of each utxo value.
 * @returns An array of blockchair getUtxos response.
 */
export function generateBlockChairGetUtxosResp(
  address: string,
  utxosCount: number,
  minAmount = 0,
  maxAmount = 1000000,
) {
  const template = blockChairData.getUtxoResp;
  const data = { ...template.data.tb1qlq94vt9uh07fwunsgdyycpkv24uev05ywjua0r };
  let idx = -1;
  const resp = {
    data: {
      [address]: {
        ...data,
        utxo: Array.from({ length: utxosCount }, () => {
          idx += 1;
          return {
            block_id: randomNum(1000000),
            transaction_hash: randomNum(1000000)
              .toString(16)
              .padStart(
                template.data.tb1qlq94vt9uh07fwunsgdyycpkv24uev05ywjua0r.utxo[0]
                  .transaction_hash.length,
                '0',
              ),
            index: idx,
            value: Math.max(randomNum(maxAmount), minAmount),
          };
        }),
      },
    },
  };
  return resp;
}

/**
 * Method to generate blockchair getStats resp.
 *
 * @returns A blockchair getStats resp.
 */
export function generateBlockChairGetStatsResp() {
  const template = blockChairData.getStatsResp;
  const resp: typeof template = { ...template };
  Object.entries(template.data).forEach(([key, value]) => {
    if (typeof value === 'number') {
      if (value === 0) {
        resp.data[key] = randomNum(100);
      }
      resp.data[key] = randomNum(value);
    }
  });
  resp.data.suggested_transaction_fee_per_byte_sat = randomNum(20);
  return resp;
}

/**
 * Method to generate blockchair BroadcastTransaction resp.
 *
 * @returns An txn id of blockchair BroadcastTransaction response.
 */
export function generateBlockChairBroadcastTransactionResp() {
  const template = blockChairData.broadcastTransactionResp;
  const resp: typeof template = { ...template };
  return resp;
}

/**
 * Method to generate blockchair transaction dashboards resp.
 *
 * @param txHash - Transaction hash of the transaction.
 * @param txnBlockHeight - Block height of the transaction.
 * @param txnBlockHeight - Block height of the last block.
 * @param lastBlockHeight - Block height of the last block.
 * @param confirmed - Confirm status of the transaction.
 * @returns A blockchair transaction dashboards resp.
 */
export function generateBlockChairTransactionDashboard(
  txHash: string,
  txnBlockHeight: number,
  lastBlockHeight: number,
  confirmed: boolean,
) {
  const template = blockChairData.getDashboardTransaction;
  const data = Object.values(template.data)[0];
  const resp = {
    data: {
      [txHash]: {
        ...data,
        transaction: {
          ...data.transaction,
          block_id: confirmed ? txnBlockHeight : -1,
        },
      },
    },
    context: {
      ...template.context,
      state: lastBlockHeight,
    },
  };
  return resp;
}

/**
 * Method to generate formated utxos with blockchair resp.
 *
 * @param address - the utxos owner address.
 * @param utxoCnt - count of the utox to be generated.
 * @param minAmt - min amount of the utxo array.
 * @param maxAmt - max amount of the utxo array.
 * @returns An formatted utxo array.
 */
export function generateFormatedUtxos(
  address: string,
  utxoCnt: number,
  minAmt?: number,
  maxAmt?: number,
) {
  const rawUtxos = generateBlockChairGetUtxosResp(
    address,
    utxoCnt,
    minAmt,
    maxAmt,
  );
  const formattedUtxos = rawUtxos.data[address].utxo.map((utxo) => ({
    block: utxo.block_id,
    txHash: utxo.transaction_hash,
    index: utxo.index,
    value: utxo.value,
  }));
  return formattedUtxos;
}

/* eslint-disable */
