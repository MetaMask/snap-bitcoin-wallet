import { type Network } from 'bitcoinjs-lib';

import type { IWallet } from '../../wallet';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { BtcWallet } from './wallet';

export class BtcWalletFactory {
  static create(deriver: string, network: Network): IWallet {
    return new BtcWallet(
      deriver === 'BIP44'
        ? new BtcAccountBip44Deriver(network)
        : new BtcAccountBip32Deriver(network),
      network,
    );
  }
}
