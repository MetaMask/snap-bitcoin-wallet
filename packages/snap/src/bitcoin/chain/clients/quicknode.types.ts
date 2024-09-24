import type { Network } from 'bitcoinjs-lib';

export type QuickNodeClientOptions = {
  network: Network;
  // The endpoints will be setup via the environment variable
  testnetEndpoint: string;
  mainnetEndpoint: string;
};

export type QuickNodeError = {
  code: string;
  message: string;
};

export type QuickNodeGetBalancesResponse = {
  result: null | {
    address: string;
    balance: string;
    totalReceived: string;
    totalSent: string;
    unconfirmedBalance: string;
    unconfirmedTxs: number;
    txs: number;
  };
  error: null | QuickNodeError;
};

export type QuickNodeGetUtxosResponse = {
  result:
    | null
    | {
        txid: string;
        vout: number;
        value: string;
        height: number;
        confirmations: number;
      }[];
  error: null | QuickNodeError;
};

export type QuickNodeSendTransactionResponse = {
  result: null | {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    hex: string;
  };
  error: null | QuickNodeError;
};

export type QuickNodeEstimateFeeResponse = {
  result: null | {
    blocks: number;
    feerate: number;
  };
  error: null | QuickNodeError;
};

export type QuickNodeGetTransaction = {
  result: null | {
    txid: string;
    hash: string;
    version: number;
    size: number;
    vsize: number;
    weight: number;
    locktime: number;
    vin: {
      txid: string;
      vout: number;
      scriptSig: {
        asm: string;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        hex: string;
      };
      txinwitness: string[];
      sequence: number;
    }[];
    vout: {
      value: number;
      n: number;
      scriptPubKey: Record<string, string>;
    }[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    hex: string;
    blockhash: string;
    confirmations: number;
    time: number;
    blocktime: number;
  };
  error: null | QuickNodeError;
};
