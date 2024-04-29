import { type Network } from 'bitcoinjs-lib';

import { type IWallet } from '../../keyring';
import { type BtcWalletConfig } from '../config';
import { ScriptType } from '../constants';
import { P2WPKHAccount } from './account';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { WalletFactoryError } from './exceptions';
import { BtcWallet } from './wallet';

export class BtcWalletFactory {
  static create(config: BtcWalletConfig, network: Network): IWallet {
    const type = config.defaultAccountType as ScriptType;
    switch (type) {
      case ScriptType.P2wpkh:
        return new BtcWallet(
          config.deriver === 'BIP44'
            ? new BtcAccountBip44Deriver(network)
            : new BtcAccountBip32Deriver(network),
          P2WPKHAccount,
          network,
        );
      default:
        throw new WalletFactoryError('Invalid script type');
    }
  }
}
