import type { DataClient } from './constants';

export type BtcTransactionConfig = {
  dataClient: {
    read: {
      type: DataClient;
    };
    write: {
      type: DataClient;
    };
  };
};

export type BtcAccountConfig = {
  defaultAccountIndex: number;
  defaultAccountType: string;
  deriver: string;
};
