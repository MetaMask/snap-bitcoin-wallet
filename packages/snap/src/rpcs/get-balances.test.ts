import { InvalidParamsError } from '@metamask/snaps-sdk';

import { Config } from '../config';
import { Caip2Asset, Caip2ChainId } from '../constants';
import { satsToBtc } from '../utils';
import {
  createMockChainApiFactory,
  createMockSender,
  createMockWallet,
} from './__tests__/helper';
import { getBalances } from './get-balances';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('getBalances', () => {
  const tBtc = Caip2Asset.TBtc;
  const btc = Caip2Asset.Btc;

  const createMockAccount = async (caip2ChainId: string) => {
    const wallet = createMockWallet(caip2ChainId);
    const sender = await createMockSender(wallet);

    return {
      sender,
    };
  };

  const prepareGetBalances = async () => {
    const caip2ChainId = Caip2ChainId.Testnet;
    const { getBalancesSpy } = createMockChainApiFactory();
    const { sender } = await createMockAccount(caip2ChainId);
    const addresses = [sender.address];

    const mockGetBalanceResp = {
      balances: {
        [tBtc]: {
          amount: BigInt(100),
        },
      },
    };

    getBalancesSpy.mockResolvedValue(mockGetBalanceResp);

    return {
      getBalancesSpy,
      caip2ChainId,
      sender,
      addresses,
      mockGetBalanceResp,
    };
  };

  it('gets the balances', async () => {
    const {
      getBalancesSpy,
      caip2ChainId,
      addresses,
      sender,
      mockGetBalanceResp,
    } = await prepareGetBalances();

    const expected = {
      [tBtc]: {
        amount: satsToBtc(mockGetBalanceResp.balances[tBtc].amount),
        unit: Config.unit,
      },
    };

    const result = await getBalances(sender, {
      scope: caip2ChainId,
      assets: [tBtc],
    });

    expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [tBtc]);
    expect(result).toStrictEqual(expected);
  });

  it('assign 0 balance if the given asset can not be found from the account', async () => {
    const {
      getBalancesSpy,
      caip2ChainId,
      addresses,
      sender,
      mockGetBalanceResp,
    } = await prepareGetBalances();

    // It is a never happen case that we can enquire the balance of BTC and tBTC at the same time
    // But we have to simulate this case to test the behavior of the function
    const expected = {
      [tBtc]: {
        amount: satsToBtc(mockGetBalanceResp.balances[tBtc].amount),
        unit: Config.unit,
      },
      [btc]: {
        amount: satsToBtc(0),
        unit: Config.unit,
      },
    };

    const result = await getBalances(sender, {
      scope: caip2ChainId,
      assets: [tBtc, btc],
    });

    expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [tBtc, btc]);
    expect(result).toStrictEqual(expected);
  });

  it('throws `Fail to get the balances` when transaction status fetch failed', async () => {
    const { getBalancesSpy, caip2ChainId, sender } = await prepareGetBalances();

    getBalancesSpy.mockRejectedValue(new Error('error'));

    await expect(
      getBalances(sender, {
        scope: caip2ChainId,
        assets: [tBtc],
      }),
    ).rejects.toThrow(`Fail to get the balances`);
  });

  it('throws `Request params is invalid` when request parameter is not correct', async () => {
    const caip2ChainId = Caip2ChainId.Testnet;
    const { sender } = await createMockAccount(caip2ChainId);

    await expect(
      getBalances(sender, {
        scope: caip2ChainId,
        assets: ['some-asset'],
      }),
    ).rejects.toThrow(InvalidParamsError);
  });
});
