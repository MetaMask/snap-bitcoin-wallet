import type {
  Amount,
  LocalOutput,
  WalletTx,
  Transaction,
} from '@metamask/bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from './account';
import { computeDisplayBalanceSats } from './balance';

/* eslint-disable @typescript-eslint/naming-convention */

const sat = (value: bigint): Amount =>
  ({
    to_sat: () => value,
  }) as unknown as Amount;

const mockUtxo = (opts: {
  keychain: 'external' | 'internal';
  txidString: string;
  valueSats: bigint;
}): LocalOutput =>
  ({
    keychain: opts.keychain,
    outpoint: {
      txid: { toString: () => opts.txidString },
    },
    txout: { value: sat(opts.valueSats) },
  }) as unknown as LocalOutput;

const mockWalletTx = (isConfirmed: boolean): WalletTx =>
  ({
    tx: {} as Transaction,
    chain_position: { is_confirmed: isConfirmed },
  }) as unknown as WalletTx;

describe('computeDisplayBalanceSats', () => {
  const buildAccount = (overrides: {
    trustedSpendableSats: bigint;
    utxos: LocalOutput[];
    txByTxid: Record<string, WalletTx | undefined>;
    sentByTxid: Record<string, bigint>;
  }): BitcoinAccount => {
    const account = mock<BitcoinAccount>();
    Object.defineProperty(account, 'balance', {
      get: () =>
        ({
          trusted_spendable: sat(overrides.trustedSpendableSats),
        }) as never,
    });
    account.listUnspent.mockReturnValue(overrides.utxos);
    account.getTransaction.mockImplementation((txid) => {
      return overrides.txByTxid[txid];
    });
    account.sentAndReceived.mockImplementation((tx) => {
      // Match by reference: find the txid whose mocked WalletTx.tx === tx.
      for (const [txid, walletTx] of Object.entries(overrides.txByTxid)) {
        if (walletTx && walletTx.tx === tx) {
          return [sat(overrides.sentByTxid[txid] ?? 0n), sat(0n)];
        }
      }
      return [sat(0n), sat(0n)];
    });
    return account;
  };

  it('returns trusted_spendable when there are no relevant unspents', () => {
    const account = buildAccount({
      trustedSpendableSats: 100n,
      utxos: [],
      txByTxid: {},
      sentByTxid: {},
    });

    expect(computeDisplayBalanceSats(account)).toBe(100n);
  });

  it('skips internal-keychain unspents (already in trusted_pending)', () => {
    const utxo = mockUtxo({
      keychain: 'internal',
      txidString: 'tx_internal',
      valueSats: 50n,
    });
    const account = buildAccount({
      trustedSpendableSats: 100n,
      utxos: [utxo],
      txByTxid: { tx_internal: mockWalletTx(false) },
      sentByTxid: { tx_internal: 200n },
    });

    expect(computeDisplayBalanceSats(account)).toBe(100n);
  });

  it('skips external-keychain unspents whose tx is already confirmed', () => {
    const utxo = mockUtxo({
      keychain: 'external',
      txidString: 'tx_confirmed',
      valueSats: 50n,
    });
    const account = buildAccount({
      trustedSpendableSats: 100n,
      utxos: [utxo],
      txByTxid: { tx_confirmed: mockWalletTx(true) },
      sentByTxid: { tx_confirmed: 200n },
    });

    expect(computeDisplayBalanceSats(account)).toBe(100n);
  });

  it('skips external-keychain unspents from foreign transactions (sent === 0)', () => {
    const utxo = mockUtxo({
      keychain: 'external',
      txidString: 'tx_incoming',
      valueSats: 50n,
    });
    const account = buildAccount({
      trustedSpendableSats: 100n,
      utxos: [utxo],
      txByTxid: { tx_incoming: mockWalletTx(false) },
      sentByTxid: { tx_incoming: 0n },
    });

    expect(computeDisplayBalanceSats(account)).toBe(100n);
  });

  it('includes external-keychain change from our own broadcasts (issue #597)', () => {
    const utxo = mockUtxo({
      keychain: 'external',
      txidString: 'tx_self',
      valueSats: 999_900_243n,
    });
    const account = buildAccount({
      trustedSpendableSats: 0n,
      utxos: [utxo],
      txByTxid: { tx_self: mockWalletTx(false) },
      sentByTxid: { tx_self: 1_000_000_000n },
    });

    expect(computeDisplayBalanceSats(account)).toBe(999_900_243n);
  });

  it('skips unspents whose parent tx is unknown (defensive)', () => {
    const utxo = mockUtxo({
      keychain: 'external',
      txidString: 'tx_missing',
      valueSats: 50n,
    });
    const account = buildAccount({
      trustedSpendableSats: 100n,
      utxos: [utxo],
      txByTxid: {},
      sentByTxid: {},
    });

    expect(computeDisplayBalanceSats(account)).toBe(100n);
  });

  it('sums trusted_spendable and multiple qualifying external unspents', () => {
    const owned = mockUtxo({
      keychain: 'external',
      txidString: 'tx_self',
      valueSats: 50n,
    });
    const skippedInternal = mockUtxo({
      keychain: 'internal',
      txidString: 'tx_int',
      valueSats: 70n,
    });
    const skippedConfirmed = mockUtxo({
      keychain: 'external',
      txidString: 'tx_conf',
      valueSats: 30n,
    });
    const skippedIncoming = mockUtxo({
      keychain: 'external',
      txidString: 'tx_in',
      valueSats: 20n,
    });
    const ownedSecond = mockUtxo({
      keychain: 'external',
      txidString: 'tx_self2',
      valueSats: 25n,
    });

    const account = buildAccount({
      trustedSpendableSats: 100n,
      utxos: [
        owned,
        skippedInternal,
        skippedConfirmed,
        skippedIncoming,
        ownedSecond,
      ],
      txByTxid: {
        tx_self: mockWalletTx(false),
        tx_int: mockWalletTx(false),
        tx_conf: mockWalletTx(true),
        tx_in: mockWalletTx(false),
        tx_self2: mockWalletTx(false),
      },
      sentByTxid: {
        tx_self: 100n,
        tx_int: 100n,
        tx_conf: 100n,
        tx_in: 0n,
        tx_self2: 100n,
      },
    });

    expect(computeDisplayBalanceSats(account)).toBe(100n + 50n + 25n);
  });
});
