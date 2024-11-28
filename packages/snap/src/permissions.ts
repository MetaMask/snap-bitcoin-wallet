import { KeyringRpcMethod } from '@metamask/keyring-api';

export enum InternalRpcMethod {
  GetTransactionStatus = 'chain_getTransactionStatus',
  EstimateFee = 'estimateFee',
  GetMaxSpendableBalance = 'getMaxSpendableBalance',
  StartSendTransactionFlow = 'startSendTransactionFlow',
  CreateWallet = 'createWallet',
  CreateWalletPersist = 'createWalletPersist',
  LoadWallet = 'loadWallet',
  GetState = 'getState',
  Sync = 'sync',
  GetBalance = 'getBalance',
  GetNextUnusedAddress = 'getNextUnusedAddress',
  RevealNextAddress = 'revealNextAddress',
  PeekAddress = 'peekAddress',
  ListUnusedAddresses = 'listUnusedAddresses',
  ListUnspentOutputs = 'listUnspentOutputs',
}

const dappPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.GetAccountBalances,
  KeyringRpcMethod.SubmitRequest,
  // Internal methods
  InternalRpcMethod.GetTransactionStatus,
  InternalRpcMethod.EstimateFee,
  InternalRpcMethod.GetMaxSpendableBalance,
  InternalRpcMethod.CreateWallet,
  InternalRpcMethod.CreateWalletPersist,
  InternalRpcMethod.LoadWallet,
  InternalRpcMethod.GetState,
  InternalRpcMethod.Sync,
  InternalRpcMethod.GetBalance,
  InternalRpcMethod.GetNextUnusedAddress,
  InternalRpcMethod.RevealNextAddress,
  InternalRpcMethod.PeekAddress,
  InternalRpcMethod.ListUnusedAddresses,
  InternalRpcMethod.ListUnspentOutputs,
]);

const metamaskPermissions = new Set([
  // Keyring methods
  KeyringRpcMethod.ListAccounts,
  KeyringRpcMethod.GetAccount,
  KeyringRpcMethod.CreateAccount,
  KeyringRpcMethod.FilterAccountChains,
  KeyringRpcMethod.DeleteAccount,
  KeyringRpcMethod.GetAccountBalances,
  KeyringRpcMethod.SubmitRequest,
  // Internal methods
  InternalRpcMethod.GetTransactionStatus,
  InternalRpcMethod.EstimateFee,
  InternalRpcMethod.GetMaxSpendableBalance,
  // Internal methods with a UI
  InternalRpcMethod.StartSendTransactionFlow,
]);

const allowedOrigins = [
  'https://portfolio.metamask.io',
  'https://portfolio-builds.metafi-dev.codefi.network',
  'https://dev.portfolio.metamask.io',
  'https://ramps-dev.portfolio.metamask.io',
  'http://localhost:3000',
];

const metamask = 'metamask';

export const originPermissions = new Map<string, Set<string>>([]);

for (const origin of allowedOrigins) {
  originPermissions.set(origin, dappPermissions);
}
originPermissions.set(metamask, metamaskPermissions);
