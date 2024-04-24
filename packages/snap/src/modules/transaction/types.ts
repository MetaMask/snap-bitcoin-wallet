import type { FeeRatio } from './constants';

export type Balances = Record<string, number>;

export type Balance = {
  amount: number;
};

export type Fee = {
  type: FeeRatio;
  rate: number;
};

export type Fees = {
  fees: Fee[];
};

export type AssetBalances = {
  balances: {
    [address: string]: {
      [asset: string]: Balance;
    };
  };
};

export type DraftTransaction = {
  rawTransaction: string;
};

export type ITransactionMgr = {
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;
  getFeeRates(): Promise<Fees>;
};
