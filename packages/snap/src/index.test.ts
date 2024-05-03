import * as keyringApi from '@metamask/keyring-api';
import { type Json, type JsonRpcRequest, SnapError } from '@metamask/snaps-sdk';

import { onRpcRequest, validateOrigin, onKeyringRequest } from '.';
import { Config, originPermissions } from './config';
import { BtcKeyring } from './keyring';
import type { IStaticSnapRpcHandler } from './rpc';
import { BaseSnapRpcHandler, RpcHelper } from './rpc';
import type { StaticImplements } from './types/static';

jest.mock('@metamask/keyring-api', () => ({
  ...jest.requireActual('@metamask/keyring-api'),
  handleKeyringRequest: jest.fn(),
}));

jest.mock('./modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('validateOrigin', () => {
  it('does not throws error if the origin and method is match to the allowed list', () => {
    const [origin, methods]: [string, Set<string>] = originPermissions
      .entries()
      .next().value;
    const method = methods.values().next().value;
    expect(() => validateOrigin(origin, method)).not.toThrow(SnapError);
  });

  it('throws `Origin not found` error if not origin is provided', () => {
    expect(() => validateOrigin('', 'chain_getBalances')).toThrow(
      'Origin not found',
    );
  });

  it('throws `Permission denied` error if origin not match to the allowed list', () => {
    expect(() => validateOrigin('xyz', 'chain_getBalances')).toThrow(
      'Permission denied',
    );
  });

  it('throws `Permission denied` error if the method is not match to the allowed list', () => {
    const elm = originPermissions.entries().next().value;
    expect(() => validateOrigin(elm[0], 'some_method')).toThrow(
      'Permission denied',
    );
  });
});

describe('onRpcRequest', () => {
  const createMockChainApiHandler = () => {
    const handleRequestSpy = jest.fn();
    class MockChainApiHandler
      extends BaseSnapRpcHandler
      implements
        StaticImplements<IStaticSnapRpcHandler, typeof MockChainApiHandler>
    {
      handleRequest = handleRequestSpy;
    }
    return { handler: MockChainApiHandler, handleRequestSpy };
  };

  const executeRequest = async () => {
    return onRpcRequest({
      origin: 'http://localhost:8000',
      request: {
        method: 'chain_getBalances',
        params: {
          scope: Config.avaliableNetworks[Config.chain][0],
        },
      } as unknown as JsonRpcRequest,
    });
  };

  it('executes the rpc request', async () => {
    const { handler, handleRequestSpy } = createMockChainApiHandler();
    jest.spyOn(RpcHelper, 'getRpcApiHandler').mockReturnValue(handler);
    handleRequestSpy.mockResolvedValueOnce({
      data: 1,
    } as Json);

    const resposne = await executeRequest();

    expect(resposne).toStrictEqual({ data: 1 });
  });

  it('throws SnapError if an error catched', async () => {
    const { handler, handleRequestSpy } = createMockChainApiHandler();
    jest.spyOn(RpcHelper, 'getRpcApiHandler').mockReturnValue(handler);
    handleRequestSpy.mockRejectedValue(new Error('error'));

    await expect(executeRequest()).rejects.toThrow(SnapError);
  });

  it('throws SnapError if an SnapError catched', async () => {
    const { handler, handleRequestSpy } = createMockChainApiHandler();
    jest.spyOn(RpcHelper, 'getRpcApiHandler').mockReturnValue(handler);
    handleRequestSpy.mockRejectedValue(new SnapError('error'));

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
      origin: 'http://localhost:8000',
      request: {
        method: keyringApi.KeyringRpcMethod.CreateAccount,
        params: {
          scope: Config.avaliableNetworks[Config.chain][0],
        },
      } as unknown as JsonRpcRequest,
    });
  };

  it('executes the rpc request', async () => {
    const { handler } = createMockHandleKeyringRequest();

    await executeRequest();

    expect(handler).toHaveBeenCalledWith(expect.any(BtcKeyring), {
      method: keyringApi.KeyringRpcMethod.CreateAccount,
      params: {
        scope: Config.avaliableNetworks[Config.chain][0],
      },
    });
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
});
