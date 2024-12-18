import type { AddressType, Network } from 'bitcoindevkit';

import type { BitcoinAccount } from '../entities';

export type AccountRepository = {
  get(id: string): Promise<BitcoinAccount | null>;
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;
  insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;
};
