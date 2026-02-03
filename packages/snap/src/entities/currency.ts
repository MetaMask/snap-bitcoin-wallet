import type { Network } from '@bitcoindevkit/bdk-wallet-web';

export enum CurrencyUnit {
  Bitcoin = 'BTC',
  Testnet = 'tBTC',
  Signet = 'sBTC',
  Regtest = 'rBTC',
  Fiat = 'fiat', // Can also be cryptos like ETH, but will be fiat for 99% of users
}

export const networkToCurrencyUnit: Record<Network, CurrencyUnit> = {
  bitcoin: CurrencyUnit.Bitcoin,
  testnet: CurrencyUnit.Testnet,
  testnet4: CurrencyUnit.Testnet,
  signet: CurrencyUnit.Signet,
  regtest: CurrencyUnit.Regtest,
};
