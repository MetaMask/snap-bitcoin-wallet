import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { Config } from '../config';

/**
 * Determines if Sats Protection is enabled for the given network.
 *
 * @param network - The network for which to determine if Sats Protection is enabled.
 * @returns `true` if Sats Protection is enabled, `false` otherwise.
 */
export function isSatsProtectionEnabled(network: Network): boolean {
  // Safeguard to only allow Sats Protection on mainnet (since SimpleHash
  // does not support testnet for this use case).
  return Config.defaultSatsProtectionEnabled && network === networks.bitcoin;
}
