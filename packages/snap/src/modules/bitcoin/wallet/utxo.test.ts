import {
  generateAccounts,
  generateFormatedUtxos,
} from '../../../../test/utils';
import { UtxoService } from './utxo';

describe('UtxoService', () => {
  describe('selectUtxosToSpend', () => {
    it('selects utxos', async () => {
      const accounts = generateAccounts(2);
      const { address } = accounts[0];
      const utxos = generateFormatedUtxos(address, 2, 2000, 1000000);

      const utxoService = new UtxoService();

      const result = utxoService.selectUtxosToSpend(
        utxos,
        [{ address: accounts[1].address, value: 1000 }],
        1,
      );

      expect(result).toHaveProperty('inputs', expect.any(Array));
      expect(result).toHaveProperty('outputs', expect.any(Array));
      expect(result).toHaveProperty('fee', expect.any(Number));
    });

    it('throws `not enough funds` error if the given utxos is not sufficient', async () => {
      const accounts = generateAccounts(2);
      const { address } = accounts[0];
      const utxos = generateFormatedUtxos(address, 1, 1, 1);

      const utxoService = new UtxoService();

      expect(() =>
        utxoService.selectUtxosToSpend(
          utxos,
          [{ address: accounts[1].address, value: 1000 }],
          100,
        ),
      ).toThrow('Not enough funds');
    });
  });
});
