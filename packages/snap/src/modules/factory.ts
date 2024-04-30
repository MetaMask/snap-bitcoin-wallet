import { type Keyring } from '@metamask/keyring-api';

import { type Chain, Config } from '../config';
import { type IStaticSnapRpcHandler, SendTransactionHandler } from '../rpcs';
import { BtcOnChainService } from './bitcoin/chain';
import {
  type BtcWalletConfig,
  type BtcOnChainServiceConfig,
} from './bitcoin/config';
import { DataClientFactory } from './bitcoin/data-client/factory';
import { getBtcNetwork } from './bitcoin/utils';
import { BtcWalletFactory } from './bitcoin/wallet';
import type { IOnChainService } from './chain/types';
import { BtcKeyring, KeyringStateManager, type IWallet } from './keyring';

// TODO: Temp solutio to support keyring in snap without keyring API
export type CreateBtcKeyringOptions = {
  emitEvents: boolean;
};

export class Factory {
  static createBtcOnChainServiceProvider(
    config: BtcOnChainServiceConfig,
    network: string,
  ) {
    const btcNetwork = getBtcNetwork(network);
    const readClient = DataClientFactory.createReadClient(config, btcNetwork);

    return new BtcOnChainService(readClient, {
      network: btcNetwork,
    });
  }

  static createBtcWallet(config: BtcWalletConfig, network: string) {
    const btcNetwork = getBtcNetwork(network);
    return BtcWalletFactory.create(config, btcNetwork);
  }

  static createBtcKeyringRpcMapping(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendTransaction: SendTransactionHandler,
    };
  }

  static createBtcKeyring(
    config: BtcWalletConfig,
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

  static createOnChainServiceProvider(
    chain: Chain,
    scope: string,
  ): IOnChainService {
    return Factory.createBtcOnChainServiceProvider(
      Config.onChainService[chain],
      scope,
    );
  }

  static createWallet(chain: Chain, scope: string): IWallet {
    return Factory.createBtcWallet(Config.wallet[chain], scope);
  }

  static createKeyring(chain: Chain): Keyring {
    return Factory.createBtcKeyring(Config.wallet[chain], {
      emitEvents: true,
    });
  }
}
