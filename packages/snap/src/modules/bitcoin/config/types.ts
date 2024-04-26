import type { DataClient } from '../constants';

export type BtcTransactionConfig = {
  dataClient: {
    read: {
      type: DataClient;
    };
  };
};

export type BtcAccountConfig = {
  enableMultiAccounts: boolean;
  defaultAccountIndex: number;
  defaultAccountType: string;
  deriver: string;
};
