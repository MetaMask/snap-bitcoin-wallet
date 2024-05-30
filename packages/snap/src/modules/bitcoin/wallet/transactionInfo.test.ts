import { networks } from 'bitcoinjs-lib';

import { generateAccounts } from '../../../../test/utils';
import { satsToBtc } from '../utils';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';
import { BtcTransactionInfo } from './transactionInfo';

describe('BtcTransactionInfo', () => {
  describe('toJson', () => {
    it('returns a json', async () => {
      const accounts = generateAccounts(5);
      const addresses = accounts.map((account) => account.address);
      const info = new BtcTransactionInfo();
      info.feeRate.value = 100;
      info.txnFee.value = 10000;
      info.sender = new BtcAddress(addresses[0], networks.testnet);
      let total = info.txnFee.value;

      for (let i = 1; i < addresses.length; i++) {
        total += 100000;
        info.recipients.set(
          new BtcAddress(addresses[i], networks.testnet),
          new BtcAmount(100000),
        );
      }
      info.changes.set(
        new BtcAddress(addresses[0], networks.testnet),
        new BtcAmount(500),
      );
      total += 500;

      const expectedRecipients = [...info.recipients.entries()].map(
        ([address, value]) => {
          return {
            ...address.toJson(),
            ...value.toJson(),
          };
        },
      );

      const expectedChanges = [...info.changes.entries()].map(
        ([address, value]) => {
          return {
            ...address.toJson(),
            ...value.toJson(),
          };
        },
      );

      expect(info.toJson()).toStrictEqual({
        feeRate: `${satsToBtc(100)} BTC`,
        txnFee: `${satsToBtc(10000)} BTC`,
        sender: addresses[0],
        recipients: expectedRecipients,
        changes: expectedChanges,
        total: `${satsToBtc(total)} BTC`,
      });
    });
  });
});
