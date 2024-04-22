import { type Keyring } from '@metamask/keyring-api';

import { BtcAccountMgrFactory } from './bitcoin/account';
import type { Network } from './bitcoin/config';
import {
  type BtcAccountConfig,
  type BtcTransactionConfig,
} from './bitcoin/config';
import { DataClientFactory } from './bitcoin/data-client/factory';
import { NetworkHelper } from './bitcoin/network';
import { BtcTransactionMgr } from './bitcoin/transaction';
import { Config } from './config';
import type { Chain } from './config';
import { BtcKeyring, KeyringStateManager, type IAccountMgr } from './keyring';
import type { ITransactionMgr } from './transaction/types';

export class Factory {
  static createBtcTransactionMgr(
    config: BtcTransactionConfig,
    network: string,
  ) {
    const btcNetwork = NetworkHelper.getNetwork(network as Network);
    const readClient = DataClientFactory.createReadClient(config, btcNetwork);

    return new BtcTransactionMgr(readClient, {
      network: btcNetwork,
    });
  }

  static createBtcAccountMgr(config: BtcAccountConfig, network: string) {
    const btcNetwork = NetworkHelper.getNetwork(network as Network);
    return BtcAccountMgrFactory.create(config, btcNetwork);
  }

  static createBtcKeyring(config: BtcAccountConfig): BtcKeyring {
    return new BtcKeyring(
      {
        defaultIndex: config.defaultAccountIndex,
        multiAccount: config.enableMultiAccounts,
      },
      new KeyringStateManager(),
    );
  }

  static createTransactionMgr(chain: Chain, scope: string): ITransactionMgr {
    return Factory.createBtcTransactionMgr(Config.transaction[chain], scope);
  }

  static createAccountMgr(chain: Chain, scope: string): IAccountMgr {
    return Factory.createBtcAccountMgr(Config.account[chain], scope);
  }

  static createKeyring(chain: Chain): Keyring {
    return Factory.createBtcKeyring(Config.account[chain]);
  }
}
