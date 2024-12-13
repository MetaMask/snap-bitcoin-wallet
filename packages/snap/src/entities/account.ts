import {
  FullScanRequest,
  SyncRequest,
  AddressInfo,
  AddressType,
  Balance,
  Network,
  Update,
} from 'bdk_wasm/bdk_wasm_bg';

export type BitcoinAccount = {
  id: string;
  suggestedName: string;
  balance: Balance;
  addressType: AddressType;
  network: Network;
  isScanned: boolean;
  peekAddress(index: number): AddressInfo;
  nextUnusedAddress(): AddressInfo;
  revealNextAddress(): AddressInfo;
  startFullScan(): FullScanRequest;
  startSync(): SyncRequest;
  applyUpdate(update: Update): void;
  takeStaged(): any;
  takeMerged(previousState: any): any;
};
