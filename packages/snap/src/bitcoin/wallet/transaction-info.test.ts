import { networks } from 'bitcoinjs-lib';

import { generateAccounts } from '../../../test/utils';
import { getCaip2ChainId, getExplorerUrl, satsToBtc } from '../utils';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';
import { BtcTxInfo } from './transaction-info';
import { TxOutput } from './transaction-output';

describe('BtcTxInfo', () => {
  describe('toJson', () => {
    it('returns a json', async () => {
      const network = networks.testnet;
      const accounts = generateAccounts(5);
      const addresses = accounts.map((account) => account.address);
      const fee = 10000;
      const feeRate = 100;
      let total = fee;
      const outputs: TxOutput[] = [];
      const sender = new BtcAddress(addresses[0]);

      const info = new BtcTxInfo(sender, feeRate, network);
      info.fee = fee;

      for (let i = 1; i < addresses.length; i++) {
        total += 100000;
        const output = new TxOutput(100000, addresses[i]);
        outputs.push(output);
      }

      info.addRecipients(outputs);

      info.change = new TxOutput(500, addresses[0]);
      total += 500;

      const expectedRecipients = outputs.map((recipient) => {
        return {
          address: recipient.destination.toString(true),
          value: recipient.amount.toString(true),
          explorerUrl: getExplorerUrl(
            recipient.destination.value,
            getCaip2ChainId(network),
          ),
        };
      });

      const expectedChange = [
        {
          address: info.change.destination.toString(true),
          value: info.change.amount.toString(true),
          explorerUrl: getExplorerUrl(
            info.change.destination.value,
            getCaip2ChainId(network),
          ),
        },
      ];

      expect(info.total).toBeInstanceOf(BtcAmount);
      expect(info.total.value).toStrictEqual(total);
      expect(info.sender).toStrictEqual(sender);
      expect(info.recipients).toHaveLength(expectedRecipients.length);
      expect(info.change).toBeDefined();
      expect(info.fee).toStrictEqual(fee);
      expect(info.txFee).toBeInstanceOf(BtcAmount);
      expect(info.txFee.value).toStrictEqual(fee);
      expect(info.feeRate).toBeInstanceOf(BtcAmount);
      expect(info.feeRate.value).toStrictEqual(feeRate);

      expect(info.toJson()).toStrictEqual({
        feeRate: `${satsToBtc(feeRate)} BTC`,
        txFee: `${satsToBtc(fee)} BTC`,
        sender: addresses[0],
        recipients: expectedRecipients,
        changes: expectedChange,
        total: `${satsToBtc(total)} BTC`,
      });
    });
  });
});
