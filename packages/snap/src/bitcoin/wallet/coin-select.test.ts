import { Buffer } from 'buffer';

import { generateAccounts, generateFormatedUtxos } from '../../../test/utils';
import { CoinSelectService } from './coin-select';

describe('CoinSelectService', () => {
  describe('selectCoins', () => {
    it('selects utxos', async () => {
      const accounts = generateAccounts(2);
      const { address } = accounts[0];
      const utxos = generateFormatedUtxos(address, 2, 2000, 1000000);

      const coinSelectService = new CoinSelectService(1);

      const result = coinSelectService.selectCoins(
        utxos,
        [{ address: accounts[1].address, value: 1000 }],
        Buffer.from('scriptOutput'),
      );

      expect(result).toHaveProperty('inputs', expect.any(Array));
      expect(result).toHaveProperty('outputs', expect.any(Array));
      expect(result).toHaveProperty('fee', expect.any(Number));
    });

    it('throws `not enough funds` error if the given utxos is not sufficient', async () => {
      const accounts = generateAccounts(2);
      const { address } = accounts[0];
      const utxos = generateFormatedUtxos(address, 1, 1, 1);

      const coinSelectService = new CoinSelectService(100);

      expect(() =>
        coinSelectService.selectCoins(
          utxos,
          [{ address: accounts[1].address, value: 1000 }],
          Buffer.from('scriptOutput'),
        ),
      ).toThrow('Not enough funds');
    });
  });
});
