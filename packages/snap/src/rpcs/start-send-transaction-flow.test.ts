import { Caip2Asset, Caip2ChainId } from '../constants';
import {
  AccountNotFoundError,
  SendFlowRequestNotFoundError,
} from '../exceptions';
import { TransactionStatus } from '../stateManagement';
import { AssetType } from '../ui/types';
import { generateSendManyParams } from '../ui/utils';
import { StartSendTransactionFlowTest } from './__tests__/helper';
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
    jest.resetAllMocks();
  });

  it('creates a new request', async () => {
    const helper = await prepareStartSendTransactionFlow(mockScope);
    const { keyringAccount, getBalanceAndRatesSpy } = helper;
    getBalanceAndRatesSpy.mockResolvedValue({
      balances: {
        value: {
          [Caip2Asset.Btc]: { amount: '1' },
          [Caip2Asset.TBtc]: { amount: '1' },
        },
        error: '',
      },
      rates: {
        value: 62000,
        error: '',
      },
    });
    const mockRequestWithCorrectValues = {
      id: 'mock-requestId',
      interfaceId: 'mock-interfaceId',
      account: keyringAccount,
      scope: mockScope,
      transaction: generateSendManyParams(mockScope),
      status: TransactionStatus.Draft,
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
        valid: true,
        error: '',
      },
    };
    await helper.setupGetRequest(mockRequestWithCorrectValues);

    const transactionTx = await startSendTransactionFlow({
      account: keyringAccount.id,
      scope: mockScope,
    });

    expect(helper.generateSendFlowSpy).toHaveBeenCalledTimes(1);
    expect(helper.upsertRequestSpy).toHaveBeenCalledTimes(4);
    expect(transactionTx).toStrictEqual({
      txId: helper.broadCastTxResp,
    });
  });

  it('throws an error when the user rejects the transaction', async () => {
    const helper = await prepareStartSendTransactionFlow(mockScope);
    const { keyringAccount, getBalanceAndRatesSpy, createSendUIDialogMock } =
      helper;
    createSendUIDialogMock.mockResolvedValue(false);
    getBalanceAndRatesSpy.mockResolvedValue({
      balances: {
        value: {
          [Caip2Asset.Btc]: { amount: '1' },
          [Caip2Asset.TBtc]: { amount: '1' },
        },
        error: '',
      },
      rates: {
        value: 62000,
        error: '',
      },
    });
    const mockRequestWithCorrectValues = {
      id: 'mock-requestId',
      interfaceId: 'mock-interfaceId',
      account: keyringAccount,
      scope: mockScope,
      transaction: generateSendManyParams(mockScope),
      status: TransactionStatus.Draft,
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
        valid: true,
        error: '',
      },
    };
    await helper.setupGetRequest(mockRequestWithCorrectValues);
    await helper.rejectSnapRequest();

    await expect(
      startSendTransactionFlow({
        account: keyringAccount.id,
        scope: mockScope,
      }),
    ).rejects.toThrow('User rejected the request');
  });

  it('throws an error when the account is not found', async () => {
    await expect(
      startSendTransactionFlow({
        account: 'non-existing-account-id',
        scope: mockScope,
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('throws an error when send flow request is not found', async () => {
    const helper = await prepareStartSendTransactionFlow(mockScope);
    const { keyringAccount, getBalanceAndRatesSpy } = helper;
    getBalanceAndRatesSpy.mockResolvedValue({
      balances: {
        value: {
          [Caip2Asset.Btc]: { amount: '1' },
          [Caip2Asset.TBtc]: { amount: '1' },
        },
        error: '',
      },
      rates: {
        value: 62000,
        error: '',
      },
    });
    // @ts-expect-error - We are testing the error case
    await helper.setupGetRequest(null);

    await expect(
      startSendTransactionFlow({
        account: keyringAccount.id,
        scope: mockScope,
      }),
    ).rejects.toThrow(SendFlowRequestNotFoundError);
  });
});
