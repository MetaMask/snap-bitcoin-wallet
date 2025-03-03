import {
  KeyringAccount,
  Transaction,
  TransactionStatus,
} from '@metamask/keyring-api';
import { BtcMethod } from '@metamask/keyring-api';
import { Address, TxOut } from 'bitcoindevkit';
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

type TransactionRecipient = {
  address: string;
  asset: TransactionAmount;
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
  const network = account.network;
  const status: TransactionStatus = tx.chain_position.is_confirmed
    ? TransactionStatus.Confirmed
    : TransactionStatus.Unconfirmed;

  // Send if we have as an input an output that we own
  const isSend = tx.tx.input.some((input) => {
    return account.getOutput(input.previous_output.toString()) !== undefined;
  });

  const [events, timestamp] = mapToEvents(tx);

  return {
    id: tx.txid.toString(),
    type: isSend ? 'send' : 'receive',
    account: account.id,
    chain: networkToCaip2[network],
    status,
    timestamp,
    to: tx.tx.output.map((output) => mapToAssetMovement(output, network)),
    from: tx.tx.input.flatMap((input) => {
      const output = account.tx_graph.get_txout(input.previous_output);
      // Skip if no output
      if (!output) {
        return [];
      }

      return [mapToAssetMovement(output, network)];
    }),
    events,
    fees: [
      {
        type: 'priority',
        asset: mapToAmount(account.calculateFee(tx.tx), network),
      },
    ],
  };
}

function mapToAmount(amount: Amount, network: Network): TransactionAmount {
  return {
    amount: amount.to_btc().toString(),
    fungible: true,
    unit: networkToCurrencyUnit[network],
    type: networkToCaip19[network],
  };
}

function mapToAssetMovement(output: TxOut, network: Network) {
  return {
    address: Address.from_script(output.script_pubkey, network).toString(),
    asset: mapToAmount(output.value, network),
  };
}

function mapToEvents(tx: WalletTx): [TransactionEvent[], number | null] {
  let timestamp = Number(tx.chain_position.last_seen) ?? null;
  const events: TransactionEvent[] = [
    {
      status: 'unconfirmed',
      timestamp,
    },
  ];
  if (tx.chain_position.anchor) {
    timestamp = Number(tx.chain_position.anchor.confirmation_time);
    events.push({
      status: 'confirmed',
      timestamp: Number(tx.chain_position.anchor.confirmation_time),
    });
  }
  return [events, timestamp];
}
