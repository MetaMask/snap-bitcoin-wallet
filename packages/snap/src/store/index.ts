import type { AddressType, Network } from 'bdk_wasm';

import type { BitcoinAccount } from '../entities';

export type AccountRepository = {
  get(id: string): Promise<BitcoinAccount | null>;
  list(): Promise<string[]>;
  insert(network: Network, addressType: AddressType): Promise<BitcoinAccount>;
  update(account: BitcoinAccount): Promise<void>;
  delete(id: string): Promise<void>;
};
