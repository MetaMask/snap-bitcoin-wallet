import { type Keyring } from '@metamask/keyring-api';

import { type Chain, Config } from '../config';
import { type IStaticSnapRpcHandler, SendTransactionHandler } from '../rpcs';
import { BtcAccountMgrFactory } from './bitcoin/account';
import { BtcTransactionMgr } from './bitcoin/chain';
import {
  type BtcAccountConfig,
  type BtcTransactionConfig,
} from './bitcoin/config';
import { DataClientFactory } from './bitcoin/data-client/factory';
import { getBtcNetwork } from './bitcoin/utils';
import type { ITransactionMgr } from './chain/types';
import { BtcKeyring, KeyringStateManager, type IAccountMgr } from './keyring';

// TODO: Temp solutio to support keyring in snap without keyring API
export type CreateBtcKeyringOptions = {
  emitEvents: boolean;
};

export class Factory {
  static createBtcTransactionMgr(
    config: BtcTransactionConfig,
    network: string,
  ) {
    const btcNetwork = getBtcNetwork(network);
    const readClient = DataClientFactory.createReadClient(config, btcNetwork);

    return new BtcTransactionMgr(readClient, {
      network: btcNetwork,
    });
  }

  static createBtcAccountMgr(config: BtcAccountConfig, network: string) {
    const btcNetwork = getBtcNetwork(network);
    return BtcAccountMgrFactory.create(config, btcNetwork);
  }

  static createBtcKeyringRpcMapping(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendTransaction: SendTransactionHandler,
    };
  }

  static createBtcKeyring(
    config: BtcAccountConfig,
    options: CreateBtcKeyringOptions,
  ): BtcKeyring {
    return new BtcKeyring(
      new KeyringStateManager(),
      Factory.createBtcKeyringRpcMapping(),
      {
        defaultIndex: config.defaultAccountIndex,
        multiAccount: config.enableMultiAccounts,
        // TODO: Temp solutio to support keyring in snap without keyring API
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
