import {
  type BtcAccountConfig,
  type BtcTransactionConfig,
  Network as BtcNetwork,
  DataClient,
} from '../bitcoin/config';

export enum Chain {
  Bitcoin = 'Bitcoin',
}

export type NetworkConfig = {
  [key in string]: string;
};

export type TransactionConfig = {
  [Chain.Bitcoin]: BtcTransactionConfig;
};

export type AccountConfig = {
  [Chain.Bitcoin]: BtcAccountConfig;
};

export type SnapConfig = {
  transaction: TransactionConfig;
  account: AccountConfig;
  avaliableNetworks: {
    [key in Chain]: string[];
  };
  chain: Chain;
};

export const Config: SnapConfig = {
  transaction: {
    [Chain.Bitcoin]: {
      dataClient: {
        read: {
          type: DataClient.BlockChair,
        },
      },
    },
  },
  account: {
    [Chain.Bitcoin]: {
      enableMultiAccounts: false,
      defaultAccountIndex: 0,
      defaultAccountType: 'p2wpkh',
      deriver: 'BIP32',
    },
  },
  avaliableNetworks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    [Chain.Bitcoin]: Object.entries(BtcNetwork).map(([_, val]) => val),
  },
  chain: Chain.Bitcoin,
};
