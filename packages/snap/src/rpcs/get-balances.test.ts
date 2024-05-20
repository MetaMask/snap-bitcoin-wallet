import { generateAccounts } from '../../test/utils';
import { Factory } from '../factory';
import { BtcAsset, Network } from '../modules/bitcoin/constants';
import { GetBalancesHandler } from './get-balances';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GetBalancesHandler', () => {
  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getBalancesSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        estimateFees: jest.fn(),
        getBalances: getBalancesSpy,
        boardcastTransaction: jest.fn(),
        listTransactions: jest.fn(),
        getTransaction: jest.fn(),
        getDataForTransaction: jest.fn(),
      });
      return {
        getBalancesSpy,
      };
    };

    it('gets balances', async () => {
      const { getBalancesSpy } = createMockChainApiFactory();

      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);
      const mockResp = {
        balances: addresses.reduce((acc, address) => {
          acc[address] = {
            [BtcAsset.TBtc]: {
              amount: 100,
            },
          };
          return acc;
        }, {}),
      };
      const expected = {
        balances: addresses.reduce((acc, address) => {
          acc[address] = {
            [BtcAsset.TBtc]: {
              amount: '0.00000100',
            },
          };
          return acc;
        }, {}),
      };

      getBalancesSpy.mockResolvedValue(mockResp);

      const result = await GetBalancesHandler.getInstance().execute({
        scope: Network.Testnet,
        accounts: addresses,
        assets: [BtcAsset.TBtc],
      });

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [BtcAsset.TBtc]);
      expect(result).toStrictEqual(expected);
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      createMockChainApiFactory();
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        GetBalancesHandler.getInstance().execute({
          scope: Network.Testnet,
          accounts: addresses,
          assets: ['some-asset'],
        }),
      ).rejects.toThrow('Request params is invalid');
    });
  });
});
