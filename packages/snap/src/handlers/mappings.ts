import type { KeyringAccount, Transaction } from '@metamask/keyring-api';
import { TransactionStatus, BtcMethod } from '@metamask/keyring-api';
import { Address } from 'bitcoindevkit';
import type {
  AddressType,
  Amount,
  Network,
  WalletTx,
  TxOut,
} from 'bitcoindevkit';

import { networkToCurrencyUnit, type BitcoinAccount } from '../entities';
import type { Caip19Asset } from './caip';
import { addressTypeToCaip2, networkToCaip19, networkToCaip2 } from './caip';

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

export const addressTypeToName: Record<AddressType, string> = {
  p2pkh: 'Legacy',
  p2sh: 'Nested SegWit',
  p2wpkh: 'Native SegWit',
  p2tr: 'Taproot',
  p2wsh: 'Multisig',
};

export const networkToName: Record<Network, string> = {
  bitcoin: 'Bitcoin',
  testnet: 'Bitcoin Testnet',
  testnet4: 'Bitcoin Testnet4',
  signet: 'Bitcoin Signet',
  regtest: 'Bitcoin Regtest',
};

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

const mapToAmount = (amount: Amount, network: Network): TransactionAmount => {
  return {
    amount: amount.to_btc().toString(),
    fungible: true,
    unit: networkToCurrencyUnit[network],
    type: networkToCaip19[network],
  };
};

const mapToAssetMovement = (
  output: TxOut,
  network: Network,
): TransactionRecipient => {
  return {
    address: Address.from_script(output.script_pubkey, network).toString(),
    asset: mapToAmount(output.value, network),
  };
};

const mapToEvents = (tx: WalletTx): [TransactionEvent[], number | null] => {
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
};

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
  const { network } = account;
  const status: TransactionStatus = tx.chain_position.is_confirmed
    ? TransactionStatus.Confirmed
    : TransactionStatus.Unconfirmed;
  const [events, timestamp] = mapToEvents(tx);
  const [sent] = account.sentAndReceived(tx.tx);
  const isSend = sent.to_btc() > 0;

  const transaction: Transaction = {
    type: isSend ? 'send' : 'receive',
    id: tx.txid.toString(),
    account: account.id,
    chain: networkToCaip2[network],
    status,
    timestamp,
    events,
    to: [],
    from: [],
    fees: [
      {
        type: 'priority',
        asset: mapToAmount(account.calculateFee(tx.tx), network),
      },
    ],
  };

  // If it's a Send transaction:
  // - to: all the outputs discarding the change (so it also works for consolidations).
  // - from: empty as irrelevant because we might be sending from multiple addresses. Sufficient to say "Sent from Bitcoin Account".
  // If it's a Receive transaction:
  // - to: all the outputs spending to addresses we own.
  // - from: empty as irrevelant because we might have hundreds of inputs in a tx. Point to explorer for details.
  if (isSend) {
    for (const txout of tx.tx.output) {
      const spkIndex = account.derivationOfSpk(txout.script_pubkey);
      const isConsolidation = spkIndex && spkIndex[0] === 'external';
      if (!spkIndex || isConsolidation) {
        transaction.to.push(mapToAssetMovement(txout, network));
      }
    }
  } else {
    for (const txout of tx.tx.output) {
      if (account.isMine(txout.script_pubkey)) {
        transaction.to.push(mapToAssetMovement(txout, network));
      }
    }
  }

  console.log('transaction', JSON.stringify(transaction, null, 2));
  return transaction;
}
