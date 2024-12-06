import { AddressInfo, Balance } from 'bdk_wasm';

export interface BitcoinAccount {
  id: string;
  suggestedName: string;
  balance(): Balance;
  peekAddress(index: number): AddressInfo;
  nextUnusedAddress(): AddressInfo;
  takeStaged(): any;
}
