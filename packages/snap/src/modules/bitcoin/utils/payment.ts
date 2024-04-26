import { type Network, type Payment, payments } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import { ScriptType } from '../constants';

/**
 * Method to get bitcoinjs-lib payment instance by an bitcoin script type.
 *
 * @param type - Script type of the bitcoin account - P2pkhm, P2shP2wkh or P2wpkh.
 * @param pubkey - Public key of the account.
 * @param network - Bitcoinjs-lib network.
 * @returns The instance of bitcoinjs-lib payment.
 */
export function getBtcPaymentInst(
  type: ScriptType,
  pubkey: Buffer,
  network: Network,
): Payment {
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
