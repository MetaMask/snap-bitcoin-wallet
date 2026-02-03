import type {
  Amount,
  ChainPosition,
  LocalOutput,
  Network,
  Transaction,
  TxOut,
  WalletTx,
} from '@bitcoindevkit/bdk-wallet-web';
import { Address } from '@bitcoindevkit/bdk-wallet-web';
import type {
  DiscoveredAccount,
  KeyringAccount,
  Transaction as KeyringTransaction,
} from '@metamask/keyring-api';
import {
  DiscoveredAccountType,
  FeeType,
  TransactionStatus,
} from '@metamask/keyring-api';

import { type BitcoinAccount, networkToCurrencyUnit } from '../entities';
import type { Caip19Asset } from './caip';
import { addressTypeToCaip, networkToCaip19, networkToScope } from './caip';

export type TransactionFee = {
  type: FeeType;
  asset: TransactionAmount;
};

export type TransactionAmount = {
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

export type Utxo = {
  // Outpoint of the utxo in the format <txid>:<vout>
  outpoint: string;
  // Value of output in satoshis
  value: string;
  derivationIndex: number;
  // scriptPubley in ASM format
  scriptPubkey: string;
  scriptPubkeyHex: string;
  // If the script can be represented as an address, omitted otherwise
  address?: string;
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
      entropySource: account.entropySource, // TODO: Legacy field. To be removed once multichain accounts are out.
      exportable: false,
      entropy: {
        type: 'mnemonic',
        id: account.entropySource,
        derivationPath: `m/${account.derivationPath.slice(1).join('/')}`,
        groupIndex: account.accountIndex,
      },
    },
    methods: account.capabilities,
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
): TransactionRecipient | null => {
  if (output.script_pubkey.is_op_return()) {
    return null;
  }

  try {
    return {
      address: Address.from_script(output.script_pubkey, network).toString(),
      asset: mapToAmount(output.value, network),
    };
  } catch {
    return null;
  }
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
 * Maps an amount & network to a Fee struct
 *
 * @param amount The fee amount
 * @param network The network relevant to the fee amount
 *
 * @returns The transaction fee object
 */
export function mapToTransactionFees(
  amount: Amount,
  network: Network,
): TransactionFee {
  return {
    type: FeeType.Priority,
    asset: mapToAmount(amount, network),
  };
}

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
      ? [mapToTransactionFees(account.calculateFee(tx), network)]
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
        const recipient = mapToAssetMovement(txout, network);
        if (recipient) {
          transaction.to.push(recipient);
        }
      }
    }
  } else {
    for (const txout of tx.output) {
      if (account.isMine(txout.script_pubkey)) {
        const recipient = mapToAssetMovement(txout, network);
        if (recipient) {
          transaction.to.push(recipient);
        }
      }
    }
  }

  return transaction;
}

/**
 * Maps a PSBT to a Keyring Transaction.
 *
 * @param account - The Bitcoin account.
 * @param tx - The extracted transaction from the PSBT.
 * @returns The Keyring transaction.
 */
export function mapPsbtToTransaction(
  account: BitcoinAccount,
  tx: Transaction,
): KeyringTransaction {
  const txid = tx.compute_txid();
  const currentTime = Date.now();

  const getRecipients = (txOut: TxOut[]): TransactionRecipient[] => {
    return txOut.flatMap((output) => {
      if (account.isMine(output.script_pubkey)) {
        return [];
      }
      const recipient = mapToAssetMovement(output, account.network);
      return recipient ? [recipient] : [];
    });
  };

  return {
    type: 'send',
    id: txid.toString(),
    account: account.id,
    chain: networkToScope[account.network],
    status: TransactionStatus.Unconfirmed,
    timestamp: currentTime,
    events: [
      {
        status: TransactionStatus.Unconfirmed,
        timestamp: currentTime,
      },
    ],
    to: getRecipients(tx.output),
    from: [],
    fees: [mapToTransactionFees(account.calculateFee(tx), account.network)],
  };
}

/**
 * Maps a Bitcoin Account to a Discovered Account.
 *
 * @param account - The Bitcoin account.
 * @returns The Discovered account.
 */
export function mapToDiscoveredAccount(
  account: BitcoinAccount,
): DiscoveredAccount {
  return {
    type: DiscoveredAccountType.Bip44,
    scopes: [networkToScope[account.network]],
    derivationPath: `m/${account.derivationPath.slice(1).join('/')}`,
  };
}

/**
 * Maps a Bitcoin UTXO to a Keyring UTXO.
 *
 * @param utxo - The wallet UTXO.
 * @param network - The network of the UTXO.
 * @returns The Keyring UTXO.
 */
export function mapToUtxo(utxo: LocalOutput, network: Network): Utxo {
  let address: Address | undefined;
  try {
    address = Address.from_script(utxo.txout.script_pubkey, network);
  } catch {
    address = undefined;
  }

  return {
    derivationIndex: utxo.derivation_index,
    outpoint: utxo.outpoint.toString(),
    value: utxo.txout.value.to_sat().toString(),
    scriptPubkey: utxo.txout.script_pubkey.to_asm_string(),
    scriptPubkeyHex: utxo.txout.script_pubkey.to_hex_string(),
    address: address?.toString(),
  };
}
