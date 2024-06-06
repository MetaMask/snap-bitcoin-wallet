import { type Network, type Payment, payments } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import { ScriptType } from '../constants';

/**
 * Gets a bitcoinjs-lib payment instance based on a given bitcoin script type and public key.
 *
 * @param scriptType - The script type of the bitcoin account (P2pkh, P2shP2wkh, or P2wpkh).
 * @param pubkey - The public key of the account.
 * @param network - The bitcoinjs-lib network.
 * @returns The instance of bitcoinjs-lib payment.
 * @throws An error if an invalid script type is provided.
 */
export function getBtcPaymentInst(
  scriptType: ScriptType,
  pubkey: Buffer,
  network: Network,
): Payment {
  switch (scriptType) {
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
