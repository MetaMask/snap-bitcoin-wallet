import { type Network } from 'bitcoinjs-lib';

import { type IAccountMgr } from '../../keyring';
import { type BtcAccountConfig } from '../config';
import { P2WPKHAccount } from './account';
import { ScriptType } from './constants';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { AccountMgrFactoryError } from './exceptions';
import { BtcAccountMgr } from './manager';

export class BtcAccountMgrFactory {
  static create(config: BtcAccountConfig, network: Network): IAccountMgr {
    const type = config.defaultAccountType as ScriptType;
    switch (type) {
      case ScriptType.P2wpkh:
        return new BtcAccountMgr(
          config.deriver === 'BIP44'
            ? new BtcAccountBip44Deriver(network)
            : new BtcAccountBip32Deriver(network),
          P2WPKHAccount,
          network,
        );
      default:
        throw new AccountMgrFactoryError('Invalid script type');
    }
  }
}
