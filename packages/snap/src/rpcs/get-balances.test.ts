import type { KeyringAccount } from '@metamask/keyring-api';
import { InvalidParamsError } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidv4 } from 'uuid';

import { generateAccounts } from '../../test/utils';
import { BtcOnChainService } from '../bitcoin/chain';
import { BtcAccountDeriver, BtcWallet } from '../bitcoin/wallet';
import { Config } from '../config';
import { Caip2ChainId } from '../constants';
import { getBalances } from './get-balances';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('getBalances', () => {
  const asset = Config.avaliableAssets[0];

  const createMockChainService = () => {
    const getBalancesSpy = jest.spyOn(
      BtcOnChainService.prototype,
      'getBalances',
    );

    return {
      getBalancesSpy,
    };
  };

  const createMockDeriver = (network) => {
    const rootSpy = jest.spyOn(BtcAccountDeriver.prototype, 'getRoot');
    const childSpy = jest.spyOn(BtcAccountDeriver.prototype, 'getChild');

    return {
      instance: new BtcAccountDeriver(network),
      rootSpy,
      childSpy,
    };
  };

  const createMockAccount = async (network, caip2ChainId) => {
    const { instance } = createMockDeriver(network);
    const wallet = new BtcWallet(instance, network);
    const sender = await wallet.unlock(0, Config.wallet.defaultAccountType);
    const keyringAccount = {
      type: sender.type,
      id: uuidv4(),
      address: sender.address,
      options: {
        scope: caip2ChainId,
        index: sender.index,
      },
      methods: ['btc_sendmany'],
    };

    const walletData = {
      account: keyringAccount as unknown as KeyringAccount,
      hdPath: sender.hdPath,
      index: sender.index,
      scope: caip2ChainId,
    };

    return {
      keyringAccount,
      walletData,
      sender,
    };
  };

  it('gets balances', async () => {
    const network = networks.testnet;
    const caip2ChainId = Caip2ChainId.Testnet;
    const { getBalancesSpy } = createMockChainService();

    const { walletData, sender } = await createMockAccount(
      network,
      caip2ChainId,
    );

    const addresses = [walletData.account.address];
    const mockResp = {
      balances: addresses.reduce((acc, address) => {
        acc[address] = {
          [asset]: {
            amount: BigInt(100),
          },
        };
        return acc;
      }, {}),
    };

    const expected = {
      [asset]: {
        amount: '0.00000100',
        unit: Config.unit,
      },
    };

    getBalancesSpy.mockResolvedValue(mockResp);

    const result = await getBalances(sender, {
      scope: walletData.scope,
      assets: [asset],
    });

    expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [asset]);
    expect(result).toStrictEqual(expected);
  });

  it('gets balances of the request account only', async () => {
    const network = networks.testnet;
    const caip2ChainId = Caip2ChainId.Testnet;
    const { getBalancesSpy } = createMockChainService();
    const accounts = generateAccounts(10);
    const { walletData, sender } = await createMockAccount(
      network,
      caip2ChainId,
    );

    const addresses = [walletData.account.address];
    const mockResp = {
      balances: [
        ...addresses,
        ...accounts.map((account) => account.address),
      ].reduce((acc, address) => {
        acc[address] = {
          [asset]: {
            amount: BigInt(100),
          },
          'some-asset': {
            amount: BigInt(100),
          },
        };
        return acc;
      }, {}),
    };

    const expected = {
      [asset]: {
        amount: '0.00000100',
        unit: Config.unit,
      },
    };

    getBalancesSpy.mockResolvedValue(mockResp);

    const result = await getBalances(sender, {
      scope: Caip2ChainId.Testnet,
      assets: [asset],
    });

    expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [asset]);
    expect(result).toStrictEqual(expected);
  });

  it('throws `Fail to get the balances` when transaction status fetch failed', async () => {
    const network = networks.testnet;
    const caip2ChainId = Caip2ChainId.Testnet;
    const { getBalancesSpy } = createMockChainService();
    const { sender } = await createMockAccount(network, caip2ChainId);

    getBalancesSpy.mockRejectedValue(new Error('error'));

    await expect(
      getBalances(sender, {
        scope: Caip2ChainId.Testnet,
        assets: [asset],
      }),
    ).rejects.toThrow(`Fail to get the balances`);
  });

  it('throws `Request params is invalid` when request parameter is not correct', async () => {
    const network = networks.testnet;
    const caip2ChainId = Caip2ChainId.Testnet;
    const { sender } = await createMockAccount(network, caip2ChainId);

    await expect(
      getBalances(sender, {
        scope: Caip2ChainId.Testnet,
        assets: ['some-asset'],
      }),
    ).rejects.toThrow(InvalidParamsError);
  });
});
