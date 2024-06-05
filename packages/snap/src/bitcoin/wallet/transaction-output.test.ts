import { Buffer } from 'buffer';

import { generateAccounts } from '../../../test/utils';
import { TxOutput } from './transaction-output';

describe('TxOutput', () => {
  it('return correct property', () => {
    const account = generateAccounts(1)[0];

    const input = new TxOutput(10, account.address, Buffer.from('dummy'));

    expect(input.value).toBe(10);
    expect(input.address).toStrictEqual(account.address);
    expect(input.value).toBe(10);
  });
});
