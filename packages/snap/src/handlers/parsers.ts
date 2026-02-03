import { Psbt } from '@bitcoindevkit/bdk-wallet-web';

import { FormatError } from '../entities';

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
