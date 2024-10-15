import { getRates } from '../utils/rates';
import { getBalances } from './get-balances';
import type { GetRatesAndBalancesParams } from './get-rates-and-balances';
import { createRatesAndBalances } from './get-rates-and-balances';

jest.mock('../utils/rates');
jest.mock('./get-balances');

describe('getRatesAndBalances', () => {
  const mockAsset = {
    /* mock asset data */
  } as any;
  const mockBtcAccount = {
    /* mock btc account data */
  } as any;
  const mockScope = 'test-scope';

  const params: GetRatesAndBalancesParams = {
    asset: mockAsset,
    scope: mockScope,
    btcAccount: mockBtcAccount,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return rates and balances when both promises are fulfilled', async () => {
    (getRates as jest.Mock).mockResolvedValue('mockRates');
    (getBalances as jest.Mock).mockResolvedValue({
      [mockAsset]: { amount: 'mockBalance' },
    });

    const result = await createRatesAndBalances(params);

    expect(result).toStrictEqual({
      rates: {
        value: 'mockRates',
        error: '',
      },
      balances: {
        value: 'mockBalance',
        error: '',
      },
    });
  });

  it('should return an error for rates when getRates promise is rejected', async () => {
    (getRates as jest.Mock).mockRejectedValue(new Error('Rates error'));
    (getBalances as jest.Mock).mockResolvedValue({
      [mockAsset]: { amount: 'mockBalance' },
    });

    const result = await createRatesAndBalances(params);

    expect(result).toStrictEqual({
      rates: {
        value: undefined,
        error: 'Rates error: Rates error',
      },
      balances: {
        value: 'mockBalance',
        error: '',
      },
    });
  });

  it('should return an error for balances when getBalances promise is rejected', async () => {
    (getRates as jest.Mock).mockResolvedValue('mockRates');
    (getBalances as jest.Mock).mockRejectedValue(new Error('Balances error'));

    const result = await createRatesAndBalances(params);

    expect(result).toStrictEqual({
      rates: {
        value: 'mockRates',
        error: '',
      },
      balances: {
        value: undefined,
        error: 'Balances error: Balances error',
      },
    });
  });

  it('should return errors for both rates and balances when both promises are rejected', async () => {
    (getRates as jest.Mock).mockRejectedValue(new Error('Rates error'));
    (getBalances as jest.Mock).mockRejectedValue(new Error('Balances error'));

    const result = await createRatesAndBalances(params);

    expect(result).toStrictEqual({
      rates: {
        value: undefined,
        error: 'Rates error: Rates error',
      },
      balances: {
        value: undefined,
        error: 'Balances error: Balances error',
      },
    });
  });
});
