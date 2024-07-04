import { networks } from 'bitcoinjs-lib';

import { generateAccounts } from '../../../test/utils';
import { getCaip2ChainId, getExplorerUrl, satsToBtc } from '../utils';
import { BtcAddress } from './address';
import { BtcTxInfo } from './transaction-info';
import { TxOutput } from './transaction-output';

describe('BtcTxInfo', () => {
  describe('toJson', () => {
    it('returns a json', async () => {
      const network = networks.testnet;
      const accounts = generateAccounts(5);
      const addresses = accounts.map((account) => account.address);
      const fee = 10000;
      let total = fee;
      const outputs: TxOutput[] = [];

      for (let i = 1; i < addresses.length; i++) {
        total += 100000;
        outputs.push(new TxOutput(100000, addresses[i]));
      }
      const info = new BtcTxInfo(
        new BtcAddress(addresses[0]),
        outputs,
        10000,
        100,
        network,
      );

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

      expect(info.toJson()).toStrictEqual({
        feeRate: `${satsToBtc(100)} BTC`,
        txFee: `${satsToBtc(10000)} BTC`,
        sender: addresses[0],
        recipients: expectedRecipients,
        changes: expectedChange,
        total: `${satsToBtc(total)} BTC`,
      });
    });
  });
});
