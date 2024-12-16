import * as keyringApi from '@metamask/keyring-api';
import {
  type JsonRpcRequest,
  SnapError,
  MethodNotFoundError,
} from '@metamask/snaps-sdk';

import { onRpcRequest, validateOrigin, onKeyringRequest } from '.';
import * as entry from '.';
import { Config } from './config';
import { BtcKeyring } from './keyring';
import { InternalRpcMethod, originPermissions } from './permissions';
import * as estimateFeeRpc from './rpcs/estimate-fee';
import * as getTxStatusRpc from './rpcs/get-transaction-status';

jest.mock('./utils/logger');
jest.mock('@dario_nakamoto/bdk', () => ({}));
jest.mock('@metamask/keyring-api', () => ({
  ...jest.requireActual('@metamask/keyring-api'),
  handleKeyringRequest: jest.fn(),
}));

describe('validateOrigin', () => {
  it('does not throw error if the origin and method is in the allowed list', () => {
    const [origin, methods]: [string, Set<string>] = originPermissions
      .entries()
      .next().value;
    const method = methods.values().next().value;
    expect(() => validateOrigin(origin, method)).not.toThrow(SnapError);
  });

  it('throws `Origin not found` error if not origin is provided', () => {
    expect(() => validateOrigin('', 'chain_getTransactionStatus')).toThrow(
      'Origin not found',
    );
  });

  it('throws `Permission denied` error if origin not in the allowed list', () => {
    expect(() => validateOrigin('xyz', 'chain_getTransactionStatus')).toThrow(
      'Permission denied',
    );
  });

  it('throws `Permission denied` error if the method is not in the allowed list', () => {
    const elm = originPermissions.entries().next().value;
    expect(() => validateOrigin(elm[0], 'some_method')).toThrow(
      'Permission denied',
    );
  });
});

describe('onRpcRequest', () => {
  const executeRequest = async (
    method = InternalRpcMethod.GetTransactionStatus,
  ) => {
    jest.spyOn(entry, 'validateOrigin').mockReturnThis();

    return onRpcRequest({
      origin: 'https://portfolio.metamask.io',
      request: {
        method,
        params: {
          scope: Config.availableNetworks[0],
        },
      } as unknown as JsonRpcRequest,
    });
  };

  it.each([
    {
      rpcMethod: InternalRpcMethod.EstimateFee,
      method: 'estimateFee',
      mockRpcModule: estimateFeeRpc,
    },
    {
      rpcMethod: InternalRpcMethod.GetTransactionStatus,
      method: 'getTransactionStatus',
      mockRpcModule: getTxStatusRpc,
    },
  ])(
    'executes the rpc request with method: $rpcKey',
    async (testData: {
      rpcMethod: InternalRpcMethod;
      method: string;
      mockRpcModule: any;
    }) => {
      const spy = jest.spyOn(testData.mockRpcModule, testData.method);

      spy.mockReturnThis();

      await executeRequest(testData.rpcMethod);

      expect(spy).toHaveBeenCalled();
    },
  );

  it('throws MethodNotFoundError if an method not found', async () => {
    // test a method that is not handled from the `onRpcRequest`
    await expect(
      executeRequest('not_aMethod' as unknown as InternalRpcMethod),
    ).rejects.toThrow(MethodNotFoundError);
  });

  it('throws SnapError if the request is failed to execute', async () => {
    jest
      .spyOn(getTxStatusRpc, 'getTransactionStatus')
      .mockRejectedValue(new SnapError('error'));
    await expect(executeRequest()).rejects.toThrow(SnapError);
  });

  it('throws SnapError if the error is not an instance of SnapError', async () => {
    jest
      .spyOn(getTxStatusRpc, 'getTransactionStatus')
      .mockRejectedValue(new Error('error'));
    await expect(executeRequest()).rejects.toThrow(SnapError);
  });
});

describe('onKeyringRequest', () => {
  const createMockHandleKeyringRequest = () => {
    const handleKeyringRequestSpy = jest.spyOn(
      keyringApi,
      'handleKeyringRequest',
    );
    return { handler: handleKeyringRequestSpy };
  };

  const executeRequest = async () => {
    return onKeyringRequest({
      origin: 'https://portfolio.metamask.io',
      request: {
        method: keyringApi.KeyringRpcMethod.ListAccounts,
        params: {
          scope: Config.availableNetworks[0],
        },
      } as unknown as JsonRpcRequest,
    });
  };

  it('executes the rpc request', async () => {
    const { handler } = createMockHandleKeyringRequest();

    await executeRequest();

    expect(handler).toHaveBeenCalledWith(expect.any(BtcKeyring), {
      method: keyringApi.KeyringRpcMethod.ListAccounts,
      params: {
        scope: Config.availableNetworks[0],
      },
    });
  });

  it('does not throw a `Permission denied` error if the dapp origin requests a method that is on the allowed list', async () => {
    const { handler } = createMockHandleKeyringRequest();
    handler.mockResolvedValue({});

    for (const method of [
      keyringApi.KeyringRpcMethod.ListAccounts,
      keyringApi.KeyringRpcMethod.GetAccount,
      keyringApi.KeyringRpcMethod.GetAccountBalances,
      keyringApi.KeyringRpcMethod.SubmitRequest,
      InternalRpcMethod.GetTransactionStatus,
      InternalRpcMethod.EstimateFee,
      InternalRpcMethod.GetMaxSpendableBalance,
    ]) {
      const result = await onKeyringRequest({
        origin: 'https://portfolio.metamask.io',
        request: {
          method,
          params: {
            scope: Config.availableNetworks[0],
          },
        } as unknown as JsonRpcRequest,
      });
      expect(result).toStrictEqual({});
    }
  });

  it('does not throw a `Permission denied` error if the MetaMask origin requests a method that is on the allowed list', async () => {
    const { handler } = createMockHandleKeyringRequest();
    handler.mockResolvedValue({});

    for (const method of [
      keyringApi.KeyringRpcMethod.ListAccounts,
      keyringApi.KeyringRpcMethod.GetAccount,
      keyringApi.KeyringRpcMethod.CreateAccount,
      keyringApi.KeyringRpcMethod.FilterAccountChains,
      keyringApi.KeyringRpcMethod.DeleteAccount,
      keyringApi.KeyringRpcMethod.GetAccountBalances,
    ]) {
      const result = await onKeyringRequest({
        origin: 'metamask',
        request: {
          method,
          params: {
            scope: Config.availableNetworks[0],
          },
        } as unknown as JsonRpcRequest,
      });
      expect(result).toStrictEqual({});
    }
  });

  it('throws SnapError if an error was thrown', async () => {
    const { handler } = createMockHandleKeyringRequest();
    handler.mockRejectedValue(new Error('error'));

    await expect(executeRequest()).rejects.toThrow(SnapError);
  });

  it('throws SnapError if an SnapError was thrown', async () => {
    const { handler } = createMockHandleKeyringRequest();
    handler.mockRejectedValue(new SnapError('error'));

    await expect(executeRequest()).rejects.toThrow(SnapError);
  });

  it('throws a `Permission denied` error if the dapp origin requests a method that is not on the allowed list', async () => {
    const { handler } = createMockHandleKeyringRequest();
    handler.mockResolvedValue({});

    for (const method of [
      keyringApi.KeyringRpcMethod.CreateAccount,
      keyringApi.KeyringRpcMethod.FilterAccountChains,
      keyringApi.KeyringRpcMethod.UpdateAccount,
      keyringApi.KeyringRpcMethod.DeleteAccount,
      keyringApi.KeyringRpcMethod.ListRequests,
      keyringApi.KeyringRpcMethod.GetRequest,
      keyringApi.KeyringRpcMethod.ApproveRequest,
      keyringApi.KeyringRpcMethod.RejectRequest,
    ]) {
      await expect(
        onKeyringRequest({
          origin: 'https://portfolio.metamask.io',
          request: {
            method,
            params: {
              scope: Config.availableNetworks[0],
            },
          } as unknown as JsonRpcRequest,
        }),
      ).rejects.toThrow('Permission denied');
    }
  });

  it('throws a `Permission denied` error if the MetaMask origin requests a method that is not on the allowed list', async () => {
    for (const method of [
      keyringApi.KeyringRpcMethod.ApproveRequest,
      keyringApi.KeyringRpcMethod.RejectRequest,
      keyringApi.KeyringRpcMethod.GetRequest,
      keyringApi.KeyringRpcMethod.ListRequests,
      keyringApi.KeyringRpcMethod.ExportAccount,
      keyringApi.KeyringRpcMethod.UpdateAccount,
    ]) {
      await expect(
        onKeyringRequest({
          origin: 'metamask',
          request: {
            method,
            params: {
              scope: Config.availableNetworks[0],
            },
          } as unknown as JsonRpcRequest,
        }),
      ).rejects.toThrow('Permission denied');
    }
  });
});
