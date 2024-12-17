import type { AddressInfo, AddressType, Balance } from '@dario_nakamoto/bdk';

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
