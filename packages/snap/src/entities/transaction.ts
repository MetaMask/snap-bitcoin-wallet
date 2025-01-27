export enum TransactionStatus {
  Draft = 'draft',
  Review = 'review',
  Signed = 'signed',
  Rejected = 'rejected',
  Confirmed = 'confirmed',
  Pending = 'pending',
  Failure = 'failure',
}

export type TransactionRequest = {
  scope: string;
  selectedCurrency: AssetType;
  recipient: {
    address: string;
    error: string;
    valid: boolean;
  };
  fees: Currency & { loading: boolean; error: string };
  amount: Currency & { error: string; valid: boolean };
  rates: string;
  balance: Currency; // TODO: To be removed once metadata is available
  total: Currency & { error: string; valid: boolean };
};

export type Currency = {
  amount: string;
  fiat: string;
};

export enum AssetType {
  BTC = 'BTC',
  FIAT = '$',
}
