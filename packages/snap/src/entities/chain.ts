import { Update } from 'bdk_wasm/bdk_wasm_bg';
import { BitcoinAccount } from './account';

export type BlockchainClient = {
  fullScan(account: BitcoinAccount): Promise<Update>;
  sync(account: BitcoinAccount): Promise<Update>;
};
