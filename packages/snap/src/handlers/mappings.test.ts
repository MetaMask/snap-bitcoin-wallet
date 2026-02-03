import type {
  Transaction,
  TxOut,
  ScriptBuf,
  Amount,
  Txid,
} from '@bitcoindevkit/bdk-wallet-web';
import { Address } from '@bitcoindevkit/bdk-wallet-web';
import { TransactionStatus, FeeType } from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import { Caip19Asset } from './caip';
import { mapPsbtToTransaction } from './mappings';

// Mock the entire bitcoindevkit module
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@bitcoindevkit/bdk-wallet-web', () => ({
  Address: {
    from_script: jest.fn(),
  },
}));

describe('mapPsbtToTransaction', () => {
  const ACCOUNT_ID = '724ac464-6572-4d9c-a8e2-4075c8846d65';
  const TIMESTAMP = 1234567890;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(TIMESTAMP);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Creates a mock transaction with the specified txid and outputs.
   *
   * @param txid - The transaction ID as a string.
   * @param outputs - Array of transaction outputs.
   * @returns A mocked Transaction object.
   */
  function createMockTransaction(txid: string, outputs: TxOut[]) {
    const mockTxid = mock<Txid>();
    jest.spyOn(mockTxid, 'toString').mockReturnValue(txid);

    return mock<Transaction>({
      compute_txid: () => mockTxid,
      output: outputs,
    });
  }

  /**
   * Creates a mock transaction output with the specified amount.
   *
   * @param satoshis - The amount in satoshis.
   * @returns A mocked TxOut object.
   */
  function createMockOutput(satoshis: number) {
    const mockAmount = mock<Amount>();
    jest.spyOn(mockAmount, 'to_btc').mockReturnValue(satoshis / 100_000_000);

    const mockScript = mock<ScriptBuf>();
    jest.spyOn(mockScript, 'is_op_return').mockReturnValue(false);

    return mock<TxOut>({
      script_pubkey: mockScript,
      value: mockAmount,
    });
  }

  /**
   * Creates a mock Bitcoin account.
   *
   * @param network - The network type ('bitcoin' or 'testnet').
   * @param feeSatoshis - The fee amount in satoshis.
   * @returns A mocked BitcoinAccount object.
   */
  function createMockAccount(
    network: 'bitcoin' | 'testnet' = 'bitcoin',
    feeSatoshis = 500,
  ) {
    const mockFeeAmount = mock<Amount>();
    jest
      .spyOn(mockFeeAmount, 'to_btc')
      .mockReturnValue(feeSatoshis / 100_000_000);

    const account = mock<BitcoinAccount>();
    account.id = ACCOUNT_ID;
    account.network = network;
    jest.spyOn(account, 'calculateFee').mockReturnValue(mockFeeAmount);
    jest.spyOn(account, 'isMine').mockReturnValue(false);

    return account;
  }

  it('maps a bitcoin transaction with single recipient', () => {
    const txId = 'abc123def456789';
    const account = createMockAccount();
    const output = createMockOutput(10000);
    const transaction = createMockTransaction(txId, [output]);

    jest.mocked(Address.from_script).mockImplementationOnce(
      () =>
        ({
          toString: () => 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        }) as any,
    );

    const result = mapPsbtToTransaction(account, transaction);

    expect(result).toStrictEqual({
      type: 'send',
      id: txId,
      account: ACCOUNT_ID,
      chain: 'bip122:000000000019d6689c085ae165831e93', // Bitcoin mainnet CAIP-2
      status: TransactionStatus.Unconfirmed,
      timestamp: TIMESTAMP,
      events: [
        {
          status: TransactionStatus.Unconfirmed,
          timestamp: TIMESTAMP,
        },
      ],
      to: [
        {
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          asset: {
            amount: '0.0001', // BTC amount, not sats
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
  });

  it('filters out change outputs owned by the account', () => {
    const account = createMockAccount();
    const changeOutput = createMockOutput(5000);
    const recipientOutput = createMockOutput(10000);
    const transaction = createMockTransaction('def456abc123', [
      changeOutput,
      recipientOutput,
    ]);

    // First output is change (owned by account), second is recipient
    jest
      .spyOn(account, 'isMine')
      .mockReturnValueOnce(true) // change output
      .mockReturnValueOnce(false); // recipient output

    // Only mock for the recipient since change output won't call Address.from_script
    jest.mocked(Address.from_script).mockImplementationOnce(
      () =>
        ({
          toString: () => 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        }) as any,
    );

    const result = mapPsbtToTransaction(account, transaction);

    // Should only include the recipient output
    expect(result.to).toHaveLength(1);
    expect(result.to[0]?.address).toBe(
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    );
    const asset = result.to[0]?.asset;
    expect(asset?.fungible).toBe(true);
    expect((asset as any).amount).toBe('0.0001');
  });

  it('uses testnet chain ID and tBTC unit for testnet', () => {
    const account = createMockAccount('testnet', 300); // 300 sats fee
    const output = createMockOutput(10000);
    const transaction = createMockTransaction('testnet123', [output]);

    // Mock Address.from_script for testnet address
    jest.mocked(Address.from_script).mockImplementationOnce(
      () =>
        ({
          toString: () =>
            'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
        }) as any,
    );

    const result = mapPsbtToTransaction(account, transaction);

    expect(result.chain).toBe('bip122:000000000933ea01ad0ee984209779ba'); // Testnet CAIP-2

    const recipientAsset = result.to[0]?.asset;
    expect(recipientAsset?.fungible).toBe(true);
    expect((recipientAsset as any).unit).toBe('tBTC');
    expect((recipientAsset as any).type).toBe(Caip19Asset.Testnet);

    const feeAsset = result.fees[0]?.asset;
    expect(feeAsset?.fungible).toBe(true);
    expect((feeAsset as any).unit).toBe('tBTC');
    expect((feeAsset as any).type).toBe(Caip19Asset.Testnet);
    expect((feeAsset as any).amount).toBe('0.000003');
  });

  it('includes multiple recipients', () => {
    const account = createMockAccount();
    const output1 = createMockOutput(10000);
    const output2 = createMockOutput(20000);
    const output3 = createMockOutput(5000);
    const transaction = createMockTransaction('multi123', [
      output1,
      output2,
      output3,
    ]);

    jest
      .mocked(Address.from_script)
      .mockImplementationOnce(
        () => ({ toString: () => '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' }) as any,
      )
      .mockImplementationOnce(
        () =>
          ({
            toString: () => 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          }) as any,
      )
      .mockImplementationOnce(
        () =>
          ({
            toString: () => 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          }) as any,
      );

    const result = mapPsbtToTransaction(account, transaction);

    expect(result.to).toHaveLength(3);
    expect(result.to[0]?.address).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    expect(result.to[1]?.address).toBe(
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    );
    expect(result.to[2]?.address).toBe(
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    );

    // Check amounts for each output
    const amounts = ['0.0001', '0.0002', '0.00005'];
    result.to.forEach((recipient, index) => {
      expect(recipient).toBeDefined();
      const asset = recipient?.asset;
      expect(asset?.fungible).toBe(true);
      expect((asset as any).amount).toBe(amounts[index]);
    });
  });

  it('handles transactions with no recipients (all change or empty)', () => {
    const account = createMockAccount();

    // Test empty outputs
    const emptyTx = createMockTransaction('empty123', []);
    const emptyResult = mapPsbtToTransaction(account, emptyTx);
    expect(emptyResult.to).toStrictEqual([]);

    // Test all outputs being change
    const changeOutput = createMockOutput(10000);
    const changeOnlyTx = createMockTransaction('change123', [changeOutput]);
    jest.spyOn(account, 'isMine').mockReturnValue(true);

    const changeOnlyResult = mapPsbtToTransaction(account, changeOnlyTx);
    expect(changeOnlyResult.to).toStrictEqual([]);
  });

  it('calculates and includes transaction fees', () => {
    const account = createMockAccount('bitcoin', 2500); // 2500 sats fee
    const output = createMockOutput(50000);
    const transaction = createMockTransaction('fee123', [output]);

    jest
      .mocked(Address.from_script)
      .mockImplementationOnce(() => ({ toString: () => 'bc1qtest' }) as any);

    const result = mapPsbtToTransaction(account, transaction);

    expect(account.calculateFee).toHaveBeenCalledWith(transaction);
    const feeAsset = result.fees[0]?.asset;
    expect(feeAsset?.fungible).toBe(true);
    expect((feeAsset as any).amount).toBe('0.000025'); // 2500 sats = 0.000025 BTC
  });
});
