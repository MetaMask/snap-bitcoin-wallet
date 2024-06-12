import { Buffer } from 'buffer';

import { generateAccounts } from '../../../test/utils';
import { BtcTxInfo } from './transaction-info';
import { TxOutput } from './transaction-output';

describe('BtcTxInfo', () => {
  describe('toJson', () => {
    it('returns a json', async () => {
      const accounts = generateAccounts(5);
      const addresses = accounts.map((account) => account.address);
      const fee = 10000;
      const feeRate = 100;
      let total = fee;
      const outputs: TxOutput[] = [];
      const sender = addresses[0];

      const info = new BtcTxInfo(sender, feeRate);
      info.txFee = fee;

      for (let i = 1; i < addresses.length; i++) {
        total += 100000;
        const output = new TxOutput(100000, addresses[i], Buffer.from('dummy'));
        outputs.push(output);
      }

      const change = new TxOutput(500, addresses[0], Buffer.from('dummy'));

      info.addRecipients(outputs);
      info.addChange(change);
      total += 500;

      const expectedRecipients = outputs.map((recipient) => {
        return {
          address: recipient.address,
          value: recipient.bigIntValue,
        };
      });

      expect(info.total).toBe(BigInt(total));
      expect(info.sender).toStrictEqual(sender);
      expect(info.recipients).toHaveLength(expectedRecipients.length);
      expect(info.change).toBeDefined();
      expect(info.txFee).toBe(BigInt(fee));
      expect(info.feeRate).toBe(BigInt(feeRate));
    });
  });
});
