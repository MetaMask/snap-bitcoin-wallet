import { KeyringRpcMethod } from '@metamask/keyring-api';

export enum InternalRpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
}

const dappPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.GetAccountBalances,
  KeyringRpcMethod.SubmitRequest,
]);

const metamaskPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.ListAccountTransactions,
  KeyringRpcMethod.ListAccountAssets,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.CreateAccount,
  KeyringRpcMethod.FilterAccountChains,
  KeyringRpcMethod.DeleteAccount,
  KeyringRpcMethod.GetAccountBalances,
  KeyringRpcMethod.SubmitRequest,
  // Internal methods with a UI
  InternalRpcMethod.StartSendTransactionFlow,
]);

const allowedOrigins = [
  'https://portfolio.metamask.io',
  'https://portfolio-builds.metafi-dev.codefi.network',
  'https://dev.portfolio.metamask.io',
  'https://ramps-dev.portfolio.metamask.io',
];

const metamask = 'metamask';

export const originPermissions = new Map<string, Set<string>>([]);

for (const origin of allowedOrigins) {
  originPermissions.set(origin, dappPermissions);
}
originPermissions.set(metamask, metamaskPermissions);
