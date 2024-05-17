import { Factory } from '../factory';
import { Network } from '../modules/bitcoin/constants';
import { FeeRatio } from '../modules/chain';
import { EstimateFeesHandler } from './estimate-fees';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('EstimateFeesHandler', () => {
  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const estimateFeesSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        estimateFees: estimateFeesSpy,
        getBalances: jest.fn(),
        boardcastTransaction: jest.fn(),
        listTransactions: jest.fn(),
        getTransaction: jest.fn(),
        getDataForTransaction: jest.fn(),
      });
      return {
        estimateFeesSpy,
      };
    };

    it('returns correct result', async () => {
      const { estimateFeesSpy } = createMockChainApiFactory();

      estimateFeesSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: 10,
          },
          {
            type: FeeRatio.Medium,
            rate: 5,
          },
          {
            type: FeeRatio.Slow,
            rate: 1,
          },
        ],
      });

      const result = await EstimateFeesHandler.getInstance().execute({
        scope: Network.Testnet,
      });

      expect(result).toStrictEqual({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: '10',
          },
          {
            type: FeeRatio.Medium,
            rate: '5',
          },
          {
            type: FeeRatio.Slow,
            rate: '1',
          },
        ],
      });
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      createMockChainApiFactory();

      await expect(
        EstimateFeesHandler.getInstance().execute({
          scope: 'some invalid value',
        }),
      ).rejects.toThrow('Request params is invalid');
    });
  });
});
