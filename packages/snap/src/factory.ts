import { type Keyring } from '@metamask/keyring-api';

import { Config } from './config';
import { BtcKeyring, KeyringStateManager, type IWallet } from './keyring';
import { BtcOnChainService } from './modules/bitcoin/chain';
import {
  type BtcWalletConfig,
  type BtcOnChainServiceConfig,
} from './modules/bitcoin/config';
import { DataClientFactory } from './modules/bitcoin/data-client/factory';
import { getBtcNetwork } from './modules/bitcoin/utils';
import { BtcWalletFactory } from './modules/bitcoin/wallet';
import type { IOnChainService } from './modules/chain/types';

// TODO: Temp solution to support keyring in snap without keyring API
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
    const writeClient = DataClientFactory.createWriteClient(config, btcNetwork);
    return new BtcOnChainService(readClient, writeClient, {
      network: btcNetwork,
    });
  }

  static createBtcWallet(config: BtcWalletConfig, network: string) {
    const btcNetwork = getBtcNetwork(network);
    return BtcWalletFactory.create(config, btcNetwork);
  }

  static createBtcKeyring(
    config: BtcWalletConfig,
    options: CreateBtcKeyringOptions,
  ): BtcKeyring {
    return new BtcKeyring(new KeyringStateManager(), {
      defaultIndex: config.defaultAccountIndex,
      multiAccount: config.enableMultiAccounts,
      // TODO: Temp solutio to support keyring in snap without keyring API
      emitEvents: options.emitEvents,
    });
  }

  static createOnChainServiceProvider(scope: string): IOnChainService {
    return Factory.createBtcOnChainServiceProvider(
      Config.onChainService[Config.chain],
      scope,
    );
  }

  static createWallet(scope: string): IWallet {
    return Factory.createBtcWallet(Config.wallet[Config.chain], scope);
  }

  static createKeyring(): Keyring {
    return Factory.createBtcKeyring(Config.wallet[Config.chain], {
      emitEvents: true,
    });
  }
}
