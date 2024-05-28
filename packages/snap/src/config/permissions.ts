import { KeyringRpcMethod } from '@metamask/keyring-api';

const allowSet = new Set([
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
]);

const allowedOrigins = [
  'https://metamask.github.io',
  'https://portfolio.metamask.io',
  'https://portfolio-builds.metafi-dev.codefi.network',
  'https://dev.portfolio.metamask.io',
];

const local = 'http://localhost:8000';
const metamask = 'metamask';

export const originPermissions = new Map<string, Set<string>>([]);

for (const origin of allowedOrigins) {
  originPermissions.set(origin, allowSet);
}
originPermissions.set(metamask, allowSet);
originPermissions.set(local, new Set([...allowSet, 'chain_createAccount']));
