export type Balance = {
  confirmed: number;
  unconfirmed: number;
  total: number;
};

export type ITransactionMgr = {
  getBalance(address: string): Promise<Balance>;
};
