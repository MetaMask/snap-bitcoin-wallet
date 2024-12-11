import type { AddressType, Network } from 'bdk_wasm';

import type { BitcoinAccount } from '../entities';

export type AccountRepository = {
  get(id: string): Promise<BitcoinAccount | null>;
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;
  list(): Promise<string[]>;
  insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;
  update(id: string, wallet: BitcoinAccount): Promise<BitcoinAccount>;
  delete(id: string): Promise<void>;
};
