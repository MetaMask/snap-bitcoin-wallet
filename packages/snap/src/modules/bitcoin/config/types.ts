import type { Json } from '@metamask/snaps-sdk';

import type { DataClient } from '../constants';

export type BtcOnChainServiceConfig = {
  dataClient: {
    read: {
      type: DataClient;
      options?: Record<string, Json | undefined>;
    };
  };
};

export type BtcWalletConfig = {
  enableMultiAccounts: boolean;
  defaultAccountIndex: number;
  defaultAccountType: string;
  deriver: string;
};
