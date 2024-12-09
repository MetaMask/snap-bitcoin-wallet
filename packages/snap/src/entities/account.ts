import type { AddressInfo, AddressType, Balance } from 'bdk_wasm';

export type BitcoinAccount = {
  id: string;
  suggestedName: string;
  balance: Balance;
  addressType: AddressType;
  nextUnusedAddress: AddressInfo;
  peekAddress(index: number): AddressInfo;
  takeStaged(): any;
};
