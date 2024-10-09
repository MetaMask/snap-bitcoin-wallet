import { Caip2ChainId } from '../constants';
import { AssetType } from '../ui/types';
import { StartSendTransactionFlowTest } from './__tests__/helper';
import { defaultSendManyParams } from './sendmany';
import { startSendTransactionFlow } from './start-send-transaction-flow';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

const prepareStartSendTransactionFlow = async (
  caip2ChainId,
  recipientCount = 1,
  feeRate = 1,
  utxoCount = 1,
  utxoMinVal = 100000000,
  utxoMaxVal = 100000000,
) => {
  const testHelper = new StartSendTransactionFlowTest({
    caip2ChainId,
    feeRate,
    utxoCount,
    utxoMinVal,
    utxoMaxVal,
    recipientCount,
  });

  await testHelper.setup();

  return testHelper;
};

describe('startSendTransactionFlow', () => {
  const mockScope = Caip2ChainId.Testnet;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new request', async () => {
    const helper = await prepareStartSendTransactionFlow(mockScope);
    const { keyringAccount } = helper;
    const mockRequestWithCorrectValues = {
      id: 'mock-requestId',
      interfaceId: 'mock-interfaceId',
      account: keyringAccount,
      scope: mockScope,
      transaction: defaultSendManyParams(mockScope),
      status: 'draft' as const,
      selectedCurrency: AssetType.BTC,
      recipient: {
        address: keyringAccount.address,
        error: '',
        valid: true,
      },
      fees: {
        amount: '0.01',
        fiat: '620.00',
        loading: true,
        error: '',
      },
      amount: {
        amount: '0.5',
        fiat: '31000.00',
        error: '',
        valid: true,
      },
      rates: '62000',
      balance: {
        amount: '1',
        fiat: '',
      },
      total: {
        amount: '0.51',
        fiat: '31620.00',
      },
    };
    await helper.setupGetRequest(mockRequestWithCorrectValues);

    const transactionTx = await startSendTransactionFlow({
      accountId: keyringAccount.id,
      scope: mockScope,
    });

    expect(helper.generateSendFlowSpy).toHaveBeenCalledTimes(1);
    expect(helper.upsertRequestSpy).toHaveBeenCalledTimes(3);
    expect(transactionTx).toStrictEqual({
      txId: '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098',
    });
  });

  it('throws an error when the user rejects the transaction', async () => {
    const helper = await prepareStartSendTransactionFlow(mockScope);
    const { keyringAccount } = helper;
    const mockRequestWithCorrectValues = {
      id: 'mock-requestId',
      interfaceId: 'mock-interfaceId',
      account: keyringAccount,
      scope: mockScope,
      transaction: defaultSendManyParams(mockScope),
      status: 'draft' as const,
      selectedCurrency: AssetType.BTC,
      recipient: {
        address: keyringAccount.address,
        error: '',
        valid: true,
      },
      fees: {
        amount: '0.01',
        fiat: '620.00',
        loading: true,
        error: '',
      },
      amount: {
        amount: '0.5',
        fiat: '31000.00',
        error: '',
        valid: true,
      },
      rates: '62000',
      balance: {
        amount: '1',
        fiat: '',
      },
      total: {
        amount: '0.51',
        fiat: '31620.00',
      },
    };
    await helper.setupGetRequest(mockRequestWithCorrectValues);
    await helper.rejectSnapRequest();

    await expect(
      startSendTransactionFlow({
        accountId: keyringAccount.id,
        scope: mockScope,
      }),
    ).rejects.toThrow('User rejected the request');
  });

  it('throws an error when the account is not found', async () => {
    await expect(
      startSendTransactionFlow({
        accountId: 'non-existing-account-id',
        scope: mockScope,
      }),
    ).rejects.toThrow('Account not found');
  });

  it('throws an error when send flow request is not found', async () => {
    const helper = await prepareStartSendTransactionFlow(mockScope);
    const { keyringAccount } = helper;
    // @ts-expect-error - We are testing the error case
    await helper.setupGetRequest(null);

    await expect(
      startSendTransactionFlow({
        accountId: keyringAccount.id,
        scope: mockScope,
      }),
    ).rejects.toThrow('Send flow request not found');
  });
});
