import { Buffer } from 'buffer';

import { generateAccounts } from '../../../test/utils';
import { TxInfo } from './transaction-info';
import { TxOutput } from './transaction-output';

describe('TxInfo', () => {
  it('accumulated total and add `TxOutput[]` as `Recipient[]`', async () => {
    const accounts = generateAccounts(5);
    const addresses = accounts.map((account) => account.address);
    const fee = 10000;
    const feeRate = 100;
    let total = fee;
    const outputs: TxOutput[] = [];
    const sender = addresses[0];

    const info = new TxInfo(sender, feeRate);
    info.txFee = fee;

    for (let i = 1; i < addresses.length; i++) {
      total += 100000;
      const output = new TxOutput(100000, addresses[i], Buffer.from('dummy'));
      outputs.push(output);
    }

    info.addRecipients(outputs);

    const expectedRecipients = outputs.map((recipient) => {
      return {
        address: recipient.address,
        value: recipient.bigIntValue,
      };
    });

    expect(info.total).toBe(BigInt(total));
    expect(info.sender).toStrictEqual(sender);
    expect(info.recipients).toHaveLength(expectedRecipients.length);
  });

  it('accumulated total with change', async () => {
    const accounts = generateAccounts(5);
    const addresses = accounts.map((account) => account.address);
    const fee = 10000;
    const feeRate = 100;
    let total = fee;
    const outputs: TxOutput[] = [];
    const sender = addresses[0];

    const info = new TxInfo(sender, feeRate);
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

    expect(info.total).toBe(BigInt(total));
    expect(info.change).toBeDefined();
  });

  it('converts number input to bigint', async () => {
    const accounts = generateAccounts(1);
    const addresses = accounts.map((account) => account.address);
    const fee = 10000;
    const feeRate = 100;
    const sender = addresses[0];

    const info = new TxInfo(sender, feeRate);
    info.txFee = fee;
    info.feeRate = feeRate;

    expect(info.txFee).toBe(BigInt(fee));
    expect(info.feeRate).toBe(BigInt(feeRate));
  });

  it('does not convert bigint input to bigint', async () => {
    const accounts = generateAccounts(1);
    const addresses = accounts.map((account) => account.address);
    const fee = 10000;
    const feeRate = 100;
    const sender = addresses[0];

    const info = new TxInfo(sender, feeRate);
    info.txFee = BigInt(fee);
    info.feeRate = BigInt(feeRate);

    expect(info.txFee).toBe(BigInt(fee));
    expect(info.feeRate).toBe(BigInt(feeRate));
  });
});
