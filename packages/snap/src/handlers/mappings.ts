import type { KeyringAccount, Transaction } from '@metamask/keyring-api';
import { BtcMethod } from '@metamask/keyring-api';
import type { Amount, Network, WalletTx } from 'bitcoindevkit';

import { networkToCurrencyUnit, type BitcoinAccount } from '../entities';
import {
  addressTypeToCaip2,
  Caip19Asset,
  networkToCaip19,
  networkToCaip2,
} from './caip';

type TransactionAmount = {
  amount: string;
  fungible: true;
  unit: string;
  type: Caip19Asset;
};

type TransactionEvent = {
  status: 'unconfirmed' | 'confirmed';
  timestamp: number | null;
};

/**
 * Reverse a map object.
 *
 * @param map - The map to reverse.
 * @returns New reversed map.
 */
export function reverseMapping<
  From extends string | number | symbol,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  To extends string | number | symbol,
>(map: Record<From, To>) {
  return Object.fromEntries(
    Object.entries(map).map(([from, to]) => [to, from]),
  ) as Record<To, From>;
}

/**
 * Maps a Bitcoin Account to a Keyring Account.
 * @param account - The Bitcoin account.
 * @returns The Keyring account.
 */
export function mapToKeyringAccount(account: BitcoinAccount): KeyringAccount {
  return {
    type: addressTypeToCaip2[account.addressType] as KeyringAccount['type'],
    scopes: [networkToCaip2[account.network]],
    id: account.id,
    address: account.peekAddress(0).address.toString(),
    options: {},
    methods: [BtcMethod.SendBitcoin],
  };
}

/**
 * Maps a Bitcoin Transaction to a Keyring Transaction.
 * @param account - The account account.
 * @param tx - The Bitcoin transaction.
 * @returns The Keyring transaction.
 */
export function mapToTransaction(
  account: BitcoinAccount,
  tx: WalletTx,
): Transaction {
  // Send if we have as an input an output that we own
  const isSend = tx.tx.input.some((input) => {
    return account.getOutput(input.previous_output.toString()) !== undefined;
  });
  console.log('txid', isSend);

  const fee = account.calculateFee(tx.tx);
  const timestamp = Number(tx.chain_position.last_seen) ?? null;
  let events: TransactionEvent[] = [
    {
      status: 'unconfirmed',
      timestamp,
    },
  ];
  if (tx.chain_position.anchor) {
    events.push({
      status: 'confirmed',
      timestamp: Number(tx.chain_position.anchor.confirmation_time),
    });
  }

  const t: Transaction = {
    id: tx.txid.toString(),
    type: isSend ? 'send' : 'receive',
    account: account.id,
    chain: networkToCaip2[account.network],
    timestamp,
    status: tx.chain_position.is_confirmed ? 'confirmed' : 'unconfirmed',
    to: tx.tx.output.map((output) => {
      return {
        address: output.script_pubkey.toString(),
        asset: mapToAmount(output.value, account.network),
      };
    }),
    from: tx.tx.input.flatMap((input) => {
      const output = account.getOutput(input.previous_output.toString());
      // Skip if no output
      if (!output) {
        return [];
      }

      return [
        {
          address: input.script_sig.toString(),
          asset: mapToAmount(output.txout.value, account.network),
        },
      ];
    }),
    events,
    fees: [
      {
        type: 'priority',
        asset: mapToAmount(fee, account.network),
      },
    ],
  };

  console.log('transaction', t);

  return t;
}

function mapToAmount(amount: Amount, network: Network): TransactionAmount {
  return {
    amount: amount.to_btc().toString(),
    fungible: true,
    unit: networkToCurrencyUnit[network],
    type: networkToCaip19[network],
  };
}
