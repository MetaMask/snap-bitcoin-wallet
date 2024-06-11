import { type Keyring } from '@metamask/keyring-api';

import { BtcOnChainService } from './bitcoin/chain';
import { DataClientFactory } from './bitcoin/data-client/factory';
import { getBtcNetwork } from './bitcoin/utils';
import { BtcAccountBip32Deriver, BtcWallet } from './bitcoin/wallet';
import type { IOnChainService } from './chain';
import { Config } from './config';
import { BtcKeyring } from './keyring';
import { KeyringStateManager } from './stateManagement';
import type { IWallet } from './wallet';

// TODO: Remove temp solution to support keyring in snap without keyring API
export type CreateBtcKeyringOptions = {
  emitEvents: boolean;
};

export class Factory {
  static createOnChainServiceProvider(scope: string): IOnChainService {
    const btcNetwork = getBtcNetwork(scope);
    const readClient = DataClientFactory.createReadClient(
      Config.onChainService,
      btcNetwork,
    );
    const writeClient = DataClientFactory.createWriteClient(
      Config.onChainService,
      btcNetwork,
    );
    return new BtcOnChainService(readClient, writeClient, {
      network: btcNetwork,
    });
  }

  static createWallet(scope: string): IWallet {
    const btcNetwork = getBtcNetwork(scope);
    return new BtcWallet(new BtcAccountBip32Deriver(btcNetwork), btcNetwork);
  }

  //  CHECK - remove fn
  static createKeyring(): Keyring {
    return new BtcKeyring(new KeyringStateManager(), {
      defaultIndex: Config.wallet.defaultAccountIndex,
      // TODO: Remove temp solution to support keyring in snap without keyring API
      emitEvents: true,
    });
  }
}
