import type { RequestArguments } from '@metamask/providers';

import { useMetaMaskContext } from './MetamaskContext';

export type Request = (params: RequestArguments) => Promise<unknown | null>;

/**
 * Utility hook to consume the provider `request` method with the available provider.
 *
 * @returns The `request` function.
 */
export const useRequest = () => {
  const { provider, setError, setLoading, setResp } = useMetaMaskContext();

  /**
   * `provider.request` wrapper.
   *
   * @param params - The request params.
   * @param params.method - The method to call.
   * @param params.params - The method params.
   * @returns The result of the request.
   */
  const request: Request = async ({ method, params }) => {
    setLoading(true);
    setResp(null);
    try {
      const data =
        (await provider?.request({
          method,
          params,
        } as RequestArguments)) ?? null;

      if (
        method &&
        !['web3_clientVersion', 'wallet_getSnaps'].includes(method)
      ) {
        setResp(JSON.stringify(data, null, 2));
      }
      return data;
    } catch (requestError: any) {
      setError(requestError);

      return null;
    } finally {
      setLoading(false);
    }
  };

  return request;
};
