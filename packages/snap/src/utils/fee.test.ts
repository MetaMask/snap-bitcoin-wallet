import { DefaultTxMinFeeRateInBtcPerKvb } from '../bitcoin/wallet';
import { getMinimumFeeRateInKvb } from './fee';

describe('getMinimumFeeRateInKvb', () => {
  it.each(
    [
      // when all inputs are same
      [1, 1, 1, 1],
      // when minrelaytxfee is the largest
      [1, 2, 3, 3],
      // when mempoolminfee is the largest
      [1, 3, 2, 3],
      // when smartFee is the largest
      [4, 2, 1, 4],
      // when all inputs less than DefaultTxMinFeeRateInBtcPerKvb
      [
        DefaultTxMinFeeRateInBtcPerKvb / 10,
        DefaultTxMinFeeRateInBtcPerKvb / 10,
        DefaultTxMinFeeRateInBtcPerKvb / 10,
        DefaultTxMinFeeRateInBtcPerKvb,
      ],
    ].map((data) => ({
      smartFee: data[0],
      mempoolminfee: data[1],
      minrelaytxfee: data[2],
      expected: data[3],
    })),
  )(
    'returns the minimum require fee correctly when smartFee=$smartFee, mempoolminfee=$mempoolminfee, minrelaytxfee=$minrelaytxfee',
    ({
      smartFee,
      mempoolminfee,
      minrelaytxfee,
      expected,
    }: {
      smartFee: number;
      mempoolminfee: number;
      minrelaytxfee: number;
      expected: number;
    }) => {
      const result = getMinimumFeeRateInKvb(
        smartFee,
        mempoolminfee,
        minrelaytxfee,
      );
      expect(result).toStrictEqual(expected);
    },
  );
});
