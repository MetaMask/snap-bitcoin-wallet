import * as keyringApi from '@metamask/keyring-api';
import {
  type JsonRpcRequest,
  SnapError,
  MethodNotFoundError,
} from '@metamask/snaps-sdk';

import { onRpcRequest, validateOrigin, onKeyringRequest } from '.';
import * as entry from '.';
import { TransactionStatus } from './bitcoin/chain';
import { Config } from './config';
import { BtcKeyring } from './keyring';
import { InternalRpcMethod, originPermissions } from './permissions';
import * as getTxStatusRpc from './rpcs/get-transaction-status';

jest.mock('./utils/logger');

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
  const executeRequest = async (method = 'chain_getTransactionStatus') => {
    jest.spyOn(entry, 'validateOrigin').mockReturnThis();

    return onRpcRequest({
      origin: 'https://portfolio.metamask.io',
      request: {
        method,
        params: {
          scope: Config.avaliableNetworks[0],
        },
      } as unknown as JsonRpcRequest,
    });
  };

  it('executes the rpc request', async () => {
    jest.spyOn(getTxStatusRpc, 'getTransactionStatus').mockResolvedValue({
      status: TransactionStatus.Confirmed,
    } as unknown as getTxStatusRpc.GetTransactionStatusResponse);

    const resposne = await executeRequest();

    expect(resposne).toStrictEqual({ status: TransactionStatus.Confirmed });
  });

  it('throws MethodNotFoundError if an method not found', async () => {
    await expect(executeRequest('some-not')).rejects.toThrow(
      MethodNotFoundError,
    );
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
          scope: Config.avaliableNetworks[0],
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
        scope: Config.avaliableNetworks[0],
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
    ]) {
      const result = await onKeyringRequest({
        origin: 'https://portfolio.metamask.io',
        request: {
          method,
          params: {
            scope: Config.avaliableNetworks[0],
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
            scope: Config.avaliableNetworks[0],
          },
        } as unknown as JsonRpcRequest,
      });
      expect(result).toStrictEqual({});
    }
  });

  it('throws SnapError if an error catched', async () => {
    const { handler } = createMockHandleKeyringRequest();
    handler.mockRejectedValue(new Error('error'));

    await expect(executeRequest()).rejects.toThrow(SnapError);
  });

  it('throws SnapError if an SnapError catched', async () => {
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
              scope: Config.avaliableNetworks[0],
            },
          } as unknown as JsonRpcRequest,
        }),
      ).rejects.toThrow('Permission denied');
    }
  });

  it('throws a `Permission denied` error if the MetaMask origin requests a method that is not on the allowed list', async () => {
    for (const method of [
      keyringApi.KeyringRpcMethod.SubmitRequest,
      keyringApi.KeyringRpcMethod.ApproveRequest,
      keyringApi.KeyringRpcMethod.RejectRequest,
      keyringApi.KeyringRpcMethod.GetRequest,
      keyringApi.KeyringRpcMethod.ListRequests,
      keyringApi.KeyringRpcMethod.ExportAccount,
      keyringApi.KeyringRpcMethod.UpdateAccount,
      InternalRpcMethod.GetTransactionStatus,
      InternalRpcMethod.EstimateFee,
    ]) {
      await expect(
        onKeyringRequest({
          origin: 'metamask',
          request: {
            method,
            params: {
              scope: Config.avaliableNetworks[0],
            },
          } as unknown as JsonRpcRequest,
        }),
      ).rejects.toThrow('Permission denied');
    }
  });
});
