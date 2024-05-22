import { KeyringRpcMethod } from '@metamask/keyring-api';

export const originPermissions = new Map<string, Set<string>>([
  [
    'metamask',
    new Set([
      // Keyring methods
      KeyringRpcMethod.ListAccounts,
      KeyringRpcMethod.GetAccount,
      KeyringRpcMethod.FilterAccountChains,
      KeyringRpcMethod.DeleteAccount,
      KeyringRpcMethod.ListRequests,
      KeyringRpcMethod.GetRequest,
      KeyringRpcMethod.SubmitRequest,
      KeyringRpcMethod.RejectRequest,
      KeyringRpcMethod.SubmitRequest,
      // Chain API methods
      'chain_getBalances',
      'chain_broadcastTransaction',
      'chain_getDataForTransaction',
      'chain_estimateFees',
    ]),
  ],
  [
    'http://localhost:8000',
    new Set([
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
      // Chain API methods
      'chain_getBalances',
      'chain_createAccount',
      'chain_broadcastTransaction',
      'chain_getDataForTransaction',
      'chain_estimateFees',
    ]),
  ],
  [
    'https://metamask.github.io',
    new Set([
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
      // Chain API methods
      'chain_getBalances',
      'chain_broadcastTransaction',
      'chain_getDataForTransaction',
      'chain_estimateFees',
    ]),
  ],
]);
