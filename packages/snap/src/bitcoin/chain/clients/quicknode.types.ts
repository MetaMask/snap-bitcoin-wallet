import type { Network } from 'bitcoinjs-lib';
import type { Infer } from 'superstruct';
import { array, number, object, string } from 'superstruct';

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
  result: object({
    // eslint-disable-next-line id-denylist
    hex: string(),
  }),
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
    blockhash: string(),
    confirmations: number(),
    time: number(),
    blocktime: number(),
  }),
});

export type QuickNodeGetTransaction = QuickNodeResponse &
  Infer<typeof QuickNodeGetTransactionStruct>;
