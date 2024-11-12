import { Factory } from '../../../factory';

/**
 * Check if an address has activity on the blockchain.
 * According to BIP-0044: Please note that the algorithm works with the transaction history,
 * not account balances, so you can have an account with 0 total coins and the algorithm
 * will still continue with discovery.
 *
 * @param scope - The CAIP-2 Chain ID.
 * @param address - Address list to check for activity.
 * @returns Promise that resolves into a boolean indicating if the address has activity.
 */
export const hasActivity = async (
  scope: string,
  address: string,
): Promise<boolean> => {
  const chainApi = Factory.createOnChainServiceProvider(scope);
  const addressTransactionsMap = await chainApi.listTransactions([address]);
  const txids = addressTransactionsMap.get(address);

  if (!txids) {
    return false;
  }

  return txids.length > 0;
};

/**
 * Linear search for the first address with activity.
 * @param scope - The CAIP-2 Chain ID.
 * @param addresses - Address list to check for activity.
 * @returns Promise that resolves into an object containing the used and unused addresses.
 */
export const linearSearch = async (
  scope: string,
  addresses: string[],
): Promise<{ unusedAddresses: string[]; usedAddresses: string[] }> => {
  const usedAddresses: string[] = [];
  const unusedAddresses: string[] = [];

  for (let i = addresses.length - 1; i >= 0; i--) {
    const hasAct = await hasActivity(scope, addresses[i]);
    if (hasAct) {
      usedAddresses.unshift(addresses[i]);
      return {
        unusedAddresses,
        usedAddresses: [...addresses.slice(0, i), ...usedAddresses],
      };
    }
    unusedAddresses.unshift(addresses[i]);
  }

  return { unusedAddresses, usedAddresses };
};
