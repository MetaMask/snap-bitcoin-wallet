import { defaultSnapOrigin } from '../config';
import { useRequest } from './useRequest';

export type InvokeKeyringParams = {
  method: string;
  params?: Record<string, unknown>;
};

// FIXME: We should use the keyring's client provided by @metamask/keyring-api instead.

/**
 * Utility hook to wrap the `wallet_invokeKeyring` method.
 *
 * @param snapId - The Snap ID to invoke. Defaults to the snap ID specified in the
 * config.
 * @returns The invokeKeyring wrapper method.
 */
export const useInvokeKeyring = (snapId = defaultSnapOrigin) => {
  const request = useRequest();

  /**
   * Invoke the requested Keyring method.
   *
   * @param params - The invoke params.
   * @param params.method - The method name.
   * @param params.params - The method params.
   * @returns The Keyring response.
   */
  const invokeKeyring = async ({ method, params }: InvokeKeyringParams) =>
    request({
      method: 'wallet_invokeKeyring',
      params: {
        snapId,
        request: {
          method,
          params,
        },
      },
    });

  return invokeKeyring;
};
