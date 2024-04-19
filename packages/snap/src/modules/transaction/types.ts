export type Balances = Record<string, number>;

export type Balance = {
  amount: number;
};

export type AssetBalances = {
  balances: {
    [address: string]: {
      [asset: string]: Balance;
    };
  };
};

export type ITransactionMgr = {
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;
};
