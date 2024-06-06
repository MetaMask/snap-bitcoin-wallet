import { type Keyring } from '@metamask/keyring-api';

import { BtcOnChainService } from './bitcoin/chain';
import {
  type BtcWalletConfig,
  type BtcOnChainServiceConfig,
} from './bitcoin/config';
import { DataClientFactory } from './bitcoin/data-client/factory';
import { getBtcNetwork } from './bitcoin/utils';
import { BtcWalletFactory } from './bitcoin/wallet';
import type { IOnChainService } from './chain';
import { Config } from './config';
import { BtcKeyring, KeyringStateManager } from './keyring';
import type { IWallet } from './wallet';

// TODO: Remove temp solution to support keyring in snap without keyring API
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
      // TODO: Remove temp solution to support keyring in snap without keyring API
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
