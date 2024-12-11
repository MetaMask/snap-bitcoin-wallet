import type { AddressInfo, AddressType, Balance } from 'bdk_wasm';

export type BitcoinAccount = {
  id: string;
  suggestedName: string;
  balance: Balance;
  addressType: AddressType;
  peekAddress(index: number): AddressInfo;
  nextUnusedAddress(): AddressInfo;
  revealNextAddress(): AddressInfo;
  takeStaged(): any;
};
