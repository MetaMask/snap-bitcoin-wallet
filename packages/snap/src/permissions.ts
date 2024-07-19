import { KeyringRpcMethod } from '@metamask/keyring-api';

export enum InternalRpcMethod {
  GetTransactionStatus = 'chain_getTransactionStatus',
  EstimateFee = 'estimateFee',
  GetMaxSpendableBalance = 'getMaxSpendableBalance',
}

const dappPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.GetAccountBalances,
  KeyringRpcMethod.SubmitRequest,
  // Chain API methods
  InternalRpcMethod.GetTransactionStatus,
  // Snap API methods
  InternalRpcMethod.EstimateFee,
  InternalRpcMethod.GetMaxSpendableBalance,
]);

const metamaskPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.CreateAccount,
  KeyringRpcMethod.FilterAccountChains,
  KeyringRpcMethod.DeleteAccount,
  KeyringRpcMethod.GetAccountBalances,
]);

const allowedOrigins = [
  'https://portfolio.metamask.io',
  'https://portfolio-builds.metafi-dev.codefi.network',
  'https://dev.portfolio.metamask.io',
  'http://localhost:3000',
  'https://ramps-dev.portfolio.metamask.io',
];

const metamask = 'metamask';

export const originPermissions = new Map<string, Set<string>>([]);

for (const origin of allowedOrigins) {
  originPermissions.set(origin, dappPermissions);
}
originPermissions.set(metamask, metamaskPermissions);
