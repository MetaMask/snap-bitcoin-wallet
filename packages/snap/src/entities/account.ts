import type { AddressInfo, AddressType, Balance, Network } from 'bdk_wasm';

export type BitcoinAccount = {
  id: string;
  suggestedName: string;
  balance: Balance;
  addressType: AddressType;
  nextUnusedAddress: AddressInfo;
  network: Network;
  isScanned: boolean;
  peekAddress(index: number): AddressInfo;
  takeStaged(): any;
  takeMerged(previousState: any): any;
  fullScan(stopGap: number, parallelRequests: number): Promise<void>;
  sync(parallelRequests: number): Promise<void>;
};
