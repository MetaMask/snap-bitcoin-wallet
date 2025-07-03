import { Address } from '@metamask/bitcoindevkit';
import type {
  Amount,
  Network,
  TxOut,
  ChainPosition,
  WalletTx,
} from '@metamask/bitcoindevkit';
import type {
  DiscoveredAccount,
  KeyringAccount,
  Transaction as KeyringTransaction,
} from '@metamask/keyring-api';
import {
  TransactionStatus,
  BtcMethod,
  DiscoveredAccountType,
} from '@metamask/keyring-api';

import {
  addressTypeToPurpose,
  networkToCoinType,
  networkToCurrencyUnit,
  type BitcoinAccount,
} from '../entities';
import type { Caip19Asset } from './caip';
import { addressTypeToCaip, networkToCaip19, networkToScope } from './caip';

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
  status: TransactionStatus;
  timestamp: number | null;
};

/**
 * Maps a Bitcoin Account to a Keyring Account.
 *
 * @param account - The Bitcoin account.
 * @returns The Keyring account.
 */
export function mapToKeyringAccount(account: BitcoinAccount): KeyringAccount {
  return {
    type: addressTypeToCaip[account.addressType] as KeyringAccount['type'],
    scopes: [networkToScope[account.network]],
    id: account.id,
    address: account.publicAddress.toString(),
    options: {
      entropySource: account.entropySource,
    },
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

const mapToEvents = (
  chainPosition: ChainPosition,
): [TransactionEvent[], number | null, TransactionStatus] => {
  let timestamp = chainPosition.last_seen
    ? Number(chainPosition.last_seen)
    : null;
  let status = TransactionStatus.Unconfirmed;
  const events: TransactionEvent[] = [
    {
      status,
      timestamp,
    },
  ];
  if (chainPosition.anchor) {
    timestamp = Number(chainPosition.anchor.confirmation_time);
    status = TransactionStatus.Confirmed;
    events.push({
      status,
      timestamp,
    });
  }
  return [events, timestamp, status];
};

/**
 * Maps a Bitcoin Transaction to a Keyring Transaction.
 *
 * @param account - The account account.
 * @param walletTx - The Bitcoin transaction managed by this account.
 * @returns The Keyring transaction.
 */
export function mapToTransaction(
  account: BitcoinAccount,
  walletTx: WalletTx,
): KeyringTransaction {
  const { tx, chain_position: chainPosition, txid } = walletTx;
  const { network } = account;

  const [events, timestamp, status] = mapToEvents(chainPosition);
  const [sent] = account.sentAndReceived(tx);
  const isSend = sent.to_btc() > 0;

  const transaction: KeyringTransaction = {
    type: isSend ? 'send' : 'receive',
    id: txid.toString(),
    account: account.id,
    chain: networkToScope[network],
    status,
    timestamp,
    events,
    to: [],
    from: [],
    fees: isSend
      ? [
          {
            type: 'priority',
            asset: mapToAmount(account.calculateFee(tx), network),
          },
        ]
      : [],
  };

  // If it's a Send transaction:
  // - to: all the outputs discarding the change (so it also works for consolidations).
  // - from: empty as irrelevant because we might be sending from multiple addresses. Sufficient to say "Sent from Bitcoin Account".
  // If it's a Receive transaction:
  // - to: all the outputs spending to addresses we own.
  // - from: empty as irrevelant because we might have hundreds of inputs in a tx. Point to explorer for details.
  if (isSend) {
    for (const txout of tx.output) {
      if (!account.isMine(txout.script_pubkey)) {
        transaction.to.push(mapToAssetMovement(txout, network));
      }
    }
  } else {
    for (const txout of tx.output) {
      if (account.isMine(txout.script_pubkey)) {
        transaction.to.push(mapToAssetMovement(txout, network));
      }
    }
  }

  return transaction;
}

/**
 * Maps a Bitcoin Account to a Discovered Account.
 *
 * @param account - The Bitcoin account.
 * @param groupIndex - The group index.
 * @returns The Discovered account.
 */
export function mapToDiscoveredAccount(
  account: BitcoinAccount,
  groupIndex: number,
): DiscoveredAccount {
  return {
    type: DiscoveredAccountType.Bip44,
    scopes: [networkToScope[account.network]],
    derivationPath: `m/${addressTypeToPurpose[account.addressType]}'/${networkToCoinType[account.network]}'/${groupIndex}'`,
  };
}
