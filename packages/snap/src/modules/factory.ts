import { type Keyring } from '@metamask/keyring-api';

import type { IStaticSnapRpcHandler } from '../rpcs';
import { GetBalancesHandler } from '../rpcs';
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

export type CreateBtcKeyringOptions = {
  emitEvents: boolean;
};

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

  static createBtcChainRpcMapping(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_getBalances: GetBalancesHandler,
    };
  }

  static createBtcKeyring(
    config: BtcAccountConfig,
    options: CreateBtcKeyringOptions,
  ): BtcKeyring {
    return new BtcKeyring(
      new KeyringStateManager(),
      Factory.createBtcChainRpcMapping(),
      {
        defaultIndex: config.defaultAccountIndex,
        multiAccount: config.enableMultiAccounts,
        emitEvents: options.emitEvents,
      },
    );
  }

  static createTransactionMgr(chain: Chain, scope: string): ITransactionMgr {
    return Factory.createBtcTransactionMgr(Config.transaction[chain], scope);
  }

  static createAccountMgr(chain: Chain, scope: string): IAccountMgr {
    return Factory.createBtcAccountMgr(Config.account[chain], scope);
  }

  static createKeyring(chain: Chain): Keyring {
    return Factory.createBtcKeyring(Config.account[chain], {
      emitEvents: true,
    });
  }
}
