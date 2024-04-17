import { type Network, payments } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import { ScriptType } from './constants';

export class AddressHelper {
  static getPayment(type: ScriptType, pubkey: Buffer, network: Network) {
    switch (type) {
      case ScriptType.P2pkh:
        return payments.p2pkh({ pubkey, network });
      case ScriptType.P2shP2wkh:
        return payments.p2sh({
          redeem: payments.p2wpkh({ pubkey, network }),
          network,
        });
      case ScriptType.P2wpkh:
        return payments.p2wpkh({ pubkey, network });
      default:
        throw new Error('Invalid script type');
    }
  }

  static trimHexPrefix = (key: string) =>
    key.startsWith('0x') ? key.substring(2) : key;
}
