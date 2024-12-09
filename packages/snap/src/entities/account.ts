import type { AddressInfo, Balance } from 'bdk_wasm';

export type BitcoinAccount = {
  id: string;
  suggestedName: string;
  balance(): Balance;
  peekAddress(index: number): AddressInfo;
  nextUnusedAddress(): AddressInfo;
  takeStaged(): any;
};
