import { type Network } from 'bitcoinjs-lib';

import type { IWallet } from '../../../wallet';
import { type BtcWalletConfig } from '../config';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { BtcWallet } from './wallet';

export class BtcWalletFactory {
  static create(config: BtcWalletConfig, network: Network): IWallet {
    return new BtcWallet(
      config.deriver === 'BIP44'
        ? new BtcAccountBip44Deriver(network)
        : new BtcAccountBip32Deriver(network),
      network,
    );
  }
}
