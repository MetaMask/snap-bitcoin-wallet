import type { Network } from 'bitcoinjs-lib';
import type { Infer } from 'superstruct';
import { array, number, object, optional, string, boolean } from 'superstruct';

export const QuickNodeTransactionStruct = object({
  // QuickNodeTransactionStruct is missing the hex field because it's restricted by superstruct
  txid: string(),
  version: string(),
  lockTime: string(),
  vin: array(
    object({
      txid: string(),
      vout: string(),
      sequence: string(),
      n: string(),
      addresses: array(string()),
      isAddress: boolean(),
      isOwn: boolean(),
      value: string(),
    }),
  ),
  // vout is missing the hex field because it's restricted by superstruct
  vout: array(
    object({
      value: string(),
      n: string(),
      spent: boolean(),
      addresses: array(string()),
      isAddress: boolean(),
      // hex: string(), error: Identifier 'hex' is restricted.
    }),
  ),
  blockHash: string(),
  height: string(),
  confirmations: string(),
  blockTime: string(),
  size: string(),
  vsize: string(),
  value: string(),
  valueIn: string(),
  fees: string(),
  // hex: string(), error: Identifier 'hex' is restricted.
});

export type QuickNodeClientOptions = {
  network: Network;
  // The endpoints will be setup via the environment variable
  testnetEndpoint: string;
  mainnetEndpoint: string;
};

export type QuickNodeError = {
  error: null | {
    code: string;
    message: string;
  };
};

export type QuickNodeResponse = QuickNodeError & {
  result: unknown;
};

export const QuickNodeGetBalancesResponseStruct = object({
  result: object({
    address: string(),
    balance: string(),
    totalReceived: string(),
    totalSent: string(),
    unconfirmedBalance: string(),
    unconfirmedTxs: number(),
    txs: number(),
    txids: optional(array(string())),
    transactions: optional(array(QuickNodeTransactionStruct)),
  }),
});

export type QuickNodeGetBalancesResponse = QuickNodeResponse &
  Infer<typeof QuickNodeGetBalancesResponseStruct>;

export const QuickNodeGetUtxosResponseStruct = object({
  result: array(
    object({
      txid: string(),
      vout: number(),
      value: string(),
      height: number(),
      confirmations: number(),
    }),
  ),
});

export type QuickNodeGetUtxosResponse = QuickNodeResponse &
  Infer<typeof QuickNodeGetUtxosResponseStruct>;

export const QuickNodeSendTransactionResponseStruct = object({
  result: string(),
});

export type QuickNodeSendTransactionResponse = QuickNodeResponse &
  Infer<typeof QuickNodeSendTransactionResponseStruct>;

export const QuickNodeEstimateFeeResponseStruct = object({
  result: object({
    blocks: number(),
    feerate: number(),
  }),
});

export type QuickNodeEstimateFeeResponse = QuickNodeResponse &
  Infer<typeof QuickNodeEstimateFeeResponseStruct>;

export const QuickNodeGetTransactionStruct = object({
  result: object({
    txid: string(),
    hash: string(),
    version: number(),
    size: number(),
    vsize: number(),
    weight: number(),
    locktime: number(),
    // eslint-disable-next-line id-denylist
    hex: string(),
    // The following fields will not be set if the transaction is in the memory pool
    blockhash: optional(string()),
    confirmations: optional(number()),
    time: optional(number()),
    blocktime: optional(number()),
  }),
});

export type QuickNodeGetTransaction = QuickNodeResponse &
  Infer<typeof QuickNodeGetTransactionStruct>;
