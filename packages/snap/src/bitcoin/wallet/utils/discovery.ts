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
 * Perform a binary search to find the set of used and unused addresses.
 * @param scope - The CAIP-2 Chain ID.
 * @param addresses - Array of addresses to check.
 * @returns Promise that resolves into an object containing the used and unused addresses.
 */
export const binarySearch = async (
  scope: string,
  addresses: string[],
): Promise<{ unusedAddresses: string[]; usedAddresses: string[] }> => {
  if (addresses.length === 0) {
    return { unusedAddresses: [], usedAddresses: [] };
  }

  if (addresses.length === 1) {
    const hasAct = await hasActivity(scope, addresses[0]);
    return hasAct
      ? { unusedAddresses: [], usedAddresses: [addresses[0]] }
      : { unusedAddresses: [addresses[0]], usedAddresses: [] };
  }

  const middleIndex = Math.floor(addresses.length / 2);
  const middleElement = addresses[middleIndex];
  const leftArray = addresses.slice(0, middleIndex);
  const rightArray = addresses.slice(middleIndex + 1);
  const { unusedAddresses: unusedRight, usedAddresses: usedRight } =
    await binarySearch(scope, rightArray);

  if (usedRight.length > 0) {
    return {
      unusedAddresses: unusedRight,
      usedAddresses: [...leftArray, middleElement, ...usedRight],
    };
  }

  if (await hasActivity(scope, addresses[middleIndex])) {
    return {
      usedAddresses: [...leftArray, middleElement, ...usedRight],
      unusedAddresses: unusedRight,
    };
  }

  // Check the index here
  const { unusedAddresses: unusedLeft, usedAddresses: usedLeft } =
    await binarySearch(scope, leftArray);

  if (usedLeft.length > 0) {
    return {
      unusedAddresses: [...unusedLeft, addresses[middleIndex], ...unusedRight],
      usedAddresses: [...usedLeft],
    };
  }

  return { unusedAddresses: addresses, usedAddresses: [] };
};

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
