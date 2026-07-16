import type { Network } from '@metamask/bitcoindevkit';
import { Psbt } from '@metamask/bitcoindevkit';

import { FormatError } from '../entities';

type ParsedDerivationPath = {
  index: number;
  network: Network;
};

/**
 * Parses and validates a BIP-44 derivation path string into its components.
 *
 * Only BIP-84 (native segwit) paths with coin type 0 (mainnet) or 1 (regtest)
 * are accepted.
 *
 * @param path - A derivation path string, e.g. `m/84'/0'/2'`
 * @returns The account index and network derived from the path.
 * @throws {FormatError} If the path is malformed or uses an unsupported purpose or coin type.
 */
export function parseDerivationPath(path: string): ParsedDerivationPath {
  const parts = path.split('/');
  if (parts.length < 4) {
    throw new FormatError(
      'Invalid derivation path: expected at least 4 segments (m/purpose/coinType/accountIndex)',
    );
  }

  const purpose = parts[1]?.replace("'", '');
  const coinType = parts[2]?.replace("'", '');
  const accountSegment = parts[3]?.replace("'", '');

  if (purpose !== '84') {
    throw new FormatError(
      'Only native segwit (BIP-84) derivation paths are supported',
    );
  }

  if (coinType !== '0' && coinType !== '1') {
    throw new FormatError(
      'Unsupported coin type: only coin type 0 (mainnet) and 1 (regtest) are supported',
    );
  }

  const index = parseInt(accountSegment ?? '', 10);
  if (!Number.isInteger(index) || index < 0) {
    throw new FormatError(
      'Invalid derivation path: account index must be a non-negative integer',
    );
  }

  return { index, network: coinType === '0' ? 'bitcoin' : 'regtest' };
}

/**
 * Parses a PSBT encoded as a base64 string into a PSBT object.
 *
 * @param psbtBase64 - A PSBT encoded as a base64 string
 * @returns A PSBT object
 * @throws {FormatError} If the PSBT is invalid.
 */
export function parsePsbt(psbtBase64: string): Psbt {
  try {
    return Psbt.from_string(psbtBase64);
  } catch (error) {
    throw new FormatError('Invalid PSBT', { transaction: psbtBase64 }, error);
  }
}
