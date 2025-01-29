import type { Network } from 'bitcoindevkit';

export enum CurrencyUnit {
  Bitcoin = 'BTC',
  Testnet = 'tBTC',
  Signet = 'sBTC',
  Regtest = 'rBTC',
}

export const networkToCurrencyUnit: Record<Network, CurrencyUnit> = {
  bitcoin: CurrencyUnit.Bitcoin,
  testnet: CurrencyUnit.Testnet,
  testnet4: CurrencyUnit.Testnet,
  signet: CurrencyUnit.Signet,
  regtest: CurrencyUnit.Regtest,
};
