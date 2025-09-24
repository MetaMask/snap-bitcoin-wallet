import type {
  Transaction,
  TxOut,
  ScriptBuf,
  Amount,
  Txid,
} from '@metamask/bitcoindevkit';
import { Address } from '@metamask/bitcoindevkit';
import { TransactionStatus, FeeType } from '@metamask/keyring-api';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import { Caip19Asset } from './caip';
import { mapPsbtToTransaction } from './mappings';

// Mock the entire bitcoindevkit module
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Address: {
    from_script: jest.fn(),
  },
}));

describe('mapPsbtToTransaction', () => {
  let mockTxid: MockProxy<Txid>;
  let mockScriptPubkey: MockProxy<ScriptBuf>;
  let mockAmount: MockProxy<Amount>;
  let mockTxOut: MockProxy<TxOut>;
  let mockTransaction: MockProxy<Transaction>;
  let mockFeeAmount: MockProxy<Amount>;
  let mockAccount: MockProxy<BitcoinAccount>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now() for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);

    // Setup all mocks
    mockTxid = mock<Txid>();
    jest.spyOn(mockTxid, 'toString').mockReturnValue('abc123def456789');

    mockScriptPubkey = mock<ScriptBuf>();
    jest.spyOn(mockScriptPubkey, 'is_op_return').mockReturnValue(false);

    // Setup Address.from_script mock implementation
    jest.mocked(Address.from_script).mockImplementation(
      () =>
        ({
          toString: () => 'bc1qtest123address',
          free: () => undefined,
          script_pubkey: () => mockScriptPubkey,
        }) as any,
    );

    mockAmount = mock<Amount>();
    jest.spyOn(mockAmount, 'to_sat').mockReturnValue(BigInt(1000));
    jest.spyOn(mockAmount, 'to_btc').mockReturnValue(0.00001);

    mockTxOut = mock<TxOut>({
      script_pubkey: mockScriptPubkey,
      value: mockAmount,
    });

    mockTransaction = mock<Transaction>({
      compute_txid: () => mockTxid,
      output: [mockTxOut],
    });

    mockFeeAmount = mock<Amount>();
    jest.spyOn(mockFeeAmount, 'to_sat').mockReturnValue(BigInt(500));
    jest.spyOn(mockFeeAmount, 'to_btc').mockReturnValue(0.000005);

    mockAccount = mock<BitcoinAccount>({
      id: '724ac464-6572-4d9c-a8e2-4075c8846d65',
      network: 'bitcoin' as any,
    });
    jest.spyOn(mockAccount, 'isMine').mockReturnValue(false);
    jest.spyOn(mockAccount, 'calculateFee').mockReturnValue(mockFeeAmount);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a transaction to KeyringTransaction format', () => {
    const result = mapPsbtToTransaction(mockAccount, mockTransaction);

    expect(result).toStrictEqual({
      type: 'send',
      id: 'abc123def456789',
      account: '724ac464-6572-4d9c-a8e2-4075c8846d65',
      chain: 'bip122:000000000019d6689c085ae165831e93', // CAIP-2 chain ID for Bitcoin mainnet
      status: TransactionStatus.Unconfirmed,
      timestamp: 1234567890,
      events: [
        {
          status: TransactionStatus.Unconfirmed,
          timestamp: 1234567890,
        },
      ],
      to: [
        {
          address: 'bc1qtest123address',
          asset: {
            amount: '0.00001', // BTC amount, not sats
            fungible: true,
            unit: 'BTC',
            type: Caip19Asset.Bitcoin,
          },
        },
      ],
      from: [],
      fees: [
        {
          type: FeeType.Priority,
          asset: {
            amount: '0.000005', // BTC amount, not sats
            fungible: true,
            unit: 'BTC',
            type: Caip19Asset.Bitcoin,
          },
        },
      ],
    });

    expect(mockAccount.calculateFee).toHaveBeenCalledWith(mockTransaction);
    expect(mockAccount.isMine).toHaveBeenCalledWith(mockScriptPubkey);
  });

  it('filters out outputs that belong to the account (change outputs)', () => {
    const changeScriptPubkey = mock<ScriptBuf>();
    jest.spyOn(changeScriptPubkey, 'is_op_return').mockReturnValue(false);

    const recipientScriptPubkey = mock<ScriptBuf>();
    jest.spyOn(recipientScriptPubkey, 'is_op_return').mockReturnValue(false);

    const changeOutput = mock<TxOut>({
      script_pubkey: changeScriptPubkey,
      value: mockAmount,
    });

    const recipientOutput = mock<TxOut>({
      script_pubkey: recipientScriptPubkey,
      value: mockAmount,
    });

    const txWithChange = mock<Transaction>({
      compute_txid: () => mockTxid,
      output: [changeOutput, recipientOutput],
    });

    // Override the default isMine mock for this test
    let callIndex = 0;
    jest.spyOn(mockAccount, 'isMine').mockRestore();
    jest.spyOn(mockAccount, 'isMine').mockImplementation(() => {
      // First call is for change output, second is for recipient
      const isChange = callIndex === 0;
      callIndex += 1;
      return isChange;
    });

    const result = mapPsbtToTransaction(mockAccount, txWithChange);

    // Should only have one recipient (not the change output)
    expect(result.to).toHaveLength(1);
    expect(result.to[0]).toStrictEqual({
      address: 'bc1qtest123address',
      asset: {
        amount: '0.00001',
        fungible: true,
        unit: 'BTC',
        type: Caip19Asset.Bitcoin,
      },
    });
    expect(mockAccount.isMine).toHaveBeenCalledTimes(2);
  });

  it('handles testnet network correctly', () => {
    const testnetAccount = mock<BitcoinAccount>({
      ...mockAccount,
      network: 'testnet' as any,
    });

    const result = mapPsbtToTransaction(testnetAccount, mockTransaction);

    expect(result.chain).toBe('bip122:000000000933ea01ad0ee984209779ba'); // CAIP-2 chain ID for testnet
    expect(result.to).toHaveLength(1);
    expect(result.to[0]).toStrictEqual({
      address: 'bc1qtest123address',
      asset: {
        amount: '0.00001',
        fungible: true,
        unit: 'tBTC',
        type: Caip19Asset.Testnet,
      },
    });
    expect(result.fees).toHaveLength(1);
    expect(result.fees[0]).toStrictEqual({
      type: FeeType.Priority,
      asset: {
        amount: '0.000005',
        fungible: true,
        unit: 'tBTC',
        type: Caip19Asset.Testnet,
      },
    });
  });

  it('handles multiple outputs correctly', () => {
    const mockAmount1 = mock<Amount>();
    jest.spyOn(mockAmount1, 'to_sat').mockReturnValue(BigInt(1000));
    jest.spyOn(mockAmount1, 'to_btc').mockReturnValue(0.00001);

    const mockScript1 = mock<ScriptBuf>();
    jest.spyOn(mockScript1, 'is_op_return').mockReturnValue(false);
    const output1 = mock<TxOut>({
      script_pubkey: mockScript1,
      value: mockAmount1,
    });

    const mockAmount2 = mock<Amount>();
    jest.spyOn(mockAmount2, 'to_sat').mockReturnValue(BigInt(2000));
    jest.spyOn(mockAmount2, 'to_btc').mockReturnValue(0.00002);

    const mockScript2 = mock<ScriptBuf>();
    jest.spyOn(mockScript2, 'is_op_return').mockReturnValue(false);
    const output2 = mock<TxOut>({
      script_pubkey: mockScript2,
      value: mockAmount2,
    });

    const multiOutputTx = mock<Transaction>({
      compute_txid: () => mockTxid,
      output: [output1, output2],
    });

    jest.spyOn(mockAccount, 'isMine').mockReturnValue(false);

    const result = mapPsbtToTransaction(mockAccount, multiOutputTx);

    expect(result.to).toHaveLength(2);
    expect(result.to[0]).toStrictEqual({
      address: 'bc1qtest123address',
      asset: {
        amount: '0.00001',
        fungible: true,
        unit: 'BTC',
        type: Caip19Asset.Bitcoin,
      },
    });
    expect(result.to[1]).toStrictEqual({
      address: 'bc1qtest123address',
      asset: {
        amount: '0.00002',
        fungible: true,
        unit: 'BTC',
        type: Caip19Asset.Bitcoin,
      },
    });
  });

  it('always sets transaction type as send', () => {
    const result = mapPsbtToTransaction(mockAccount, mockTransaction);
    expect(result.type).toBe('send');
  });

  it('always leaves from array empty', () => {
    const result = mapPsbtToTransaction(mockAccount, mockTransaction);
    expect(result.from).toStrictEqual([]);
  });

  it('uses current timestamp for transaction and events', () => {
    const currentTime = 9876543210;
    jest.spyOn(Date, 'now').mockReturnValue(currentTime);

    const result = mapPsbtToTransaction(mockAccount, mockTransaction);

    expect(result.timestamp).toBe(currentTime);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.timestamp).toBe(currentTime);
  });

  it('handles empty outputs array', () => {
    const emptyOutputTx = mock<Transaction>({
      compute_txid: () => mockTxid,
      output: [],
    });

    const result = mapPsbtToTransaction(mockAccount, emptyOutputTx);

    expect(result.to).toStrictEqual([]);
  });

  it('handles all outputs being change (no recipients)', () => {
    jest.spyOn(mockAccount, 'isMine').mockReturnValue(true);

    const result = mapPsbtToTransaction(mockAccount, mockTransaction);

    expect(result.to).toStrictEqual([]);
    expect(mockAccount.isMine).toHaveBeenCalled();
  });
});
