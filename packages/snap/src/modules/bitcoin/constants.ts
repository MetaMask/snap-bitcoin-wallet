export enum ScriptType {
  P2pkh = 'p2pkh',
  P2shP2wkh = 'p2sh-p2wpkh',
  P2wpkh = 'p2wpkh',
}

export enum Network {
  Mainnet = 'bip122:000000000019d6689c085ae165831e93',
  Testnet = 'bip122:000000000933ea01ad0ee984209779ba',
}

export enum DataClient {
  BlockStream = 'BlockStream',
  BlockChair = 'BlockChair',
}

export enum BtcAsset {
  Btc = 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  TBtc = 'bip122:000000000933ea01ad0ee984209779ba/slip44:0',
}

// reference https://help.magiceden.io/en/articles/8665399-navigating-bitcoin-dust-understanding-limits-and-safeguarding-your-transactions-on-magic-eden
export const DustLimit = {
  /* eslint-disable */
  p2pkh: 546,
  'p2sh-p2wpkh': 540,
  p2wpkh: 294,
  /* eslint-disable */
};

export const MaxStandardTxWeight = 400000;
