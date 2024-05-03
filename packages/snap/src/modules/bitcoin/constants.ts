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
