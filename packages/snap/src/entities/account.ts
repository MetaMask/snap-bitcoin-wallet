import type {
  AddressInfo,
  AddressType,
  Balance,
} from '@dario_nakamoto/bdk/bdk_wasm_bg';

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
