import { KeyringRpcMethod } from '@metamask/keyring-api';

export enum InternalRpcMethod {
  GetTransactionStatus = 'chain_getTransactionStatus',
  CreateAccount = 'chain_createAccount',
}

const dappPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.GetAccountBalances,
  // KeyringRpcMethod.CreateAccount,
  // KeyringRpcMethod.FilterAccountChains,
  // KeyringRpcMethod.UpdateAccount,
  // KeyringRpcMethod.DeleteAccount,
  // KeyringRpcMethod.ListRequests,
  // KeyringRpcMethod.GetRequest,
  // KeyringRpcMethod.ApproveRequest,
  // KeyringRpcMethod.RejectRequest,
  KeyringRpcMethod.SubmitRequest,
  // Chain API methods
  InternalRpcMethod.GetTransactionStatus,
]);

const metamaskPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.CreateAccount,
  KeyringRpcMethod.FilterAccountChains,
  KeyringRpcMethod.UpdateAccount,
  KeyringRpcMethod.DeleteAccount,
  KeyringRpcMethod.ListRequests,
  KeyringRpcMethod.GetRequest,
  KeyringRpcMethod.ApproveRequest,
  KeyringRpcMethod.RejectRequest,
  KeyringRpcMethod.SubmitRequest,
  KeyringRpcMethod.GetAccountBalances,
  // Chain API methods
  InternalRpcMethod.GetTransactionStatus,
]);

const allowedOrigins = [
  'https://portfolio.metamask.io',
  'https://portfolio-builds.metafi-dev.codefi.network',
  'https://dev.portfolio.metamask.io',
];

const local = 'http://localhost:8000';
const metamask = 'metamask';

export const originPermissions = new Map<string, Set<string>>([]);

for (const origin of allowedOrigins) {
  originPermissions.set(origin, dappPermissions);
}
originPermissions.set(metamask, metamaskPermissions);
originPermissions.set(
  local,
  new Set([...dappPermissions, InternalRpcMethod.CreateAccount]),
);
