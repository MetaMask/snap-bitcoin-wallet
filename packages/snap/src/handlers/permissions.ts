import { KeyringRpcMethod } from '@metamask/keyring-api';
import { UnauthorizedError } from '@metamask/snaps-sdk';

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

export const validateOrigin = (origin: string, method: string) => {
  if (!origin) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new UnauthorizedError('Origin not found');
  }
  if (!originPermissions.get(origin)?.has(method)) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new UnauthorizedError('Permission denied');
  }
};
