import { BtcMethod, type KeyringAccount } from '@metamask/keyring-api';
import { v4 as uuidV4 } from 'uuid';

import {
  generateQuickNodeSendRawTransactionResp,
  generateFormattedUtxos,
} from '../../../test/utils';
import type { Utxo } from '../../bitcoin/chain';
import { BtcOnChainService } from '../../bitcoin/chain';
import type { BtcAccount, BtcWallet } from '../../bitcoin/wallet';
import { Config } from '../../config';
import { Caip19Asset } from '../../constants';
import { Factory } from '../../factory';
import type { SendFlowRequest } from '../../stateManagement';
import { KeyringStateManager } from '../../stateManagement';
import * as renderInterfaces from '../../ui/render-interfaces';
import * as snapUtils from '../../utils/snap';
import { generateDefaultSendFlowRequest } from '../../utils/transaction';
import * as ratesAndBalances from '../get-rates-and-balances';

jest.mock('../../utils/snap');

/**
 * Create Mock Chain API Factory.
 *
 * @returns The spy instances of the Chain API methods - `getBalances`, `getFeeRates`, `getDataForTransaction`, `getTransactionStatus`, `broadcastTransaction`.
 */
export function createMockChainApiFactory() {
  const getBalancesSpy = jest.spyOn(BtcOnChainService.prototype, 'getBalances');

  const getFeeRatesSpy = jest.spyOn(BtcOnChainService.prototype, 'getFeeRates');

  const getDataForTransactionSpy = jest.spyOn(
    BtcOnChainService.prototype,
    'getDataForTransaction',
  );

  const getTransactionStatusSpy = jest.spyOn(
    BtcOnChainService.prototype,
    'getTransactionStatus',
  );

  const broadcastTransactionSpy = jest.spyOn(
    BtcOnChainService.prototype,
    'broadcastTransaction',
  );

  const createQuickNodeClientSpy = jest.spyOn(Factory, 'createQuickNodeClient');
  const createSimpleHashClientSpy = jest.spyOn(
    Factory,
    'createSimpleHashClient',
  );

  createQuickNodeClientSpy.mockReturnThis();
  createSimpleHashClientSpy.mockReturnThis();

  return {
    createQuickNodeClientSpy,
    createSimpleHashClientSpy,
    getDataForTransactionSpy,
    broadcastTransactionSpy,
    getTransactionStatusSpy,
    getBalancesSpy,
    getFeeRatesSpy,
  };
}

/**
 * Create a mock for getting balances and rates.
 *
 * @returns The spy instance for `getRatesAndBalances`.
 */
export function createRatesAndBalancesMock() {
  const getRatesAndBalancesSpy = jest.spyOn(
    ratesAndBalances,
    'createRatesAndBalances',
  );

  return getRatesAndBalancesSpy;
}

/**
 * Generate UTXOs for a given address.
 *
 * @param address - The address to generate UTXOs for.
 * @param counter - The number of UTXOs to generate.
 * @param minVal - The minimum value of the UTXOs.
 * @param maxVal - The maximum value of the UTXOs.
 * @returns The generated UTXOs.
 */
export function createMockGetDataForTransactionResp(
  address: string,
  counter: number,
  minVal = 10000,
  maxVal = 100000,
) {
  const utxos = generateFormattedUtxos(address, counter, minVal, maxVal);

  const total = utxos.reduce((acc, utxo) => acc + utxo.value, 0);

  return {
    data: utxos,
    total,
  };
}

/**
 * Create a mock wallet.
 *
 * @param caip2ChainId - The Caip2 Chain ID.
 * @returns The `BtcWallet` object.
 */
export function createMockWallet(caip2ChainId: string) {
  return Factory.createWallet(caip2ChainId);
}

/**
 * Create a mock sender account.
 *
 * @param wallet - The `BtcWallet` object.
 * @param index - The index of the account to be derived. Default is 0.
 * @param type - The type of the account. Default is `Config.wallet.defaultAccountType`.
 * @returns The `BtcAccount` object.
 */
export async function createMockSender(
  wallet: BtcWallet,
  index = 0,
  type: string = Config.wallet.defaultAccountType,
) {
  return wallet.unlock(index, type);
}

/**
 * Create a mock `keyringAccount`.
 *
 * @param account - The `BtcAccount` object.
 * @param caip2ChainId - The Caip2 Chain ID.
 * @returns The `keyringAccount` and `getWalletSpy`.
 */
export async function createMockKeyringAccount(
  account: BtcAccount,
  caip2ChainId: string,
) {
  const getWalletSpy = jest.spyOn(KeyringStateManager.prototype, 'getWallet');

  const keyringAccount = {
    type: account.type,
    id: uuidV4(),
    address: account.address,
    options: {
      scope: caip2ChainId,
      index: account.index,
    },
    methods: [`${BtcMethod.SendBitcoin}`],
  } as unknown as KeyringAccount;

  getWalletSpy.mockResolvedValue({
    account: keyringAccount,
    hdPath: `m/0'/0/${account.index}`,
    index: account.index,
    scope: caip2ChainId,
  });

  return {
    getWalletSpy,
    keyringAccount,
  };
}

/**
 * Create a mock `confirmDialog`.
 *
 * @returns The `confirmDialogSpy`.
 */
export function createMockConfirmDialog() {
  const confirmDialogSpy = jest.spyOn(snapUtils, 'confirmDialog');
  return confirmDialogSpy;
}

/**
 * Create a mock `alertDialog`.
 *
 * @returns The `alertDialogSpy`.
 */
export function createMockAlertDialog() {
  const alertDialogSpy = jest.spyOn(snapUtils, 'alertDialog');
  return alertDialogSpy;
}

/**
 * Create request mocks for testing.
 *
 * @param defaultRequest - The default send flow request.
 * @returns An object containing spies for `getRequest` and `upsertRequest`.
 */
export function createRequestMocks(defaultRequest: SendFlowRequest) {
  const getRequestSpy = jest.spyOn(KeyringStateManager.prototype, 'getRequest');
  const upsertRequestSpy = jest.spyOn(
    KeyringStateManager.prototype,
    'upsertRequest',
  );

  upsertRequestSpy.mockResolvedValue();
  getRequestSpy.mockResolvedValue(defaultRequest);

  return {
    getRequestSpy,
    upsertRequestSpy,
  };
}

/**
 * Create a mock `sendUIDialog`.
 *
 * @returns The `sendUIDialogSpy`.
 */
export function createSendUIDialogMock() {
  const sendUIDialogSpy = jest.spyOn(snapUtils, 'createSendUIDialog');
  return sendUIDialogSpy;
}

/**
 * Create mock spies for send flow functions.
 *
 * @returns An object containing spies for `generateSendFlow`, `updateSendFlow`, and `generateConfirmationReviewInterface`.
 */
export function createMockSendFlow() {
  const generateSendFlowSpy = jest.spyOn(renderInterfaces, 'generateSendFlow');
  const updateSendFlowSpy = jest.spyOn(renderInterfaces, 'updateSendFlow');
  const generateConfirmationReviewInterfaceSpy = jest.spyOn(
    renderInterfaces,
    'generateConfirmationReviewInterface',
  );

  return {
    generateSendFlowSpy,
    updateSendFlowSpy,
    generateConfirmationReviewInterfaceSpy,
  };
}

export type AccountTestCreateOption = {
  caip2ChainId: string;
};

export type EstimateFeeTestCreateOption = AccountTestCreateOption & {
  feeRate: number;
  utxoCount: number;
  utxoMinVal: number;
  utxoMaxVal: number;
};

export type SendBitcoinCreateOption = EstimateFeeTestCreateOption & {
  recipientCount: number;
};

export class AccountTest {
  testCase: AccountTestCreateOption;

  keyringAccount: KeyringAccount;

  sender: BtcAccount;

  wallet: BtcWallet;

  getWalletSpy: jest.SpyInstance;

  constructor(testCase: AccountTestCreateOption) {
    this.testCase = testCase;
  }

  async setup() {
    const { caip2ChainId } = this.testCase;
    this.wallet = createMockWallet(caip2ChainId);
    this.sender = await createMockSender(this.wallet);

    const { keyringAccount, getWalletSpy } = await createMockKeyringAccount(
      this.sender,
      caip2ChainId,
    );

    this.keyringAccount = keyringAccount;
    this.getWalletSpy = getWalletSpy;
  }

  async setupAccountNotFoundTest() {
    this.getWalletSpy.mockReset().mockResolvedValue(null);
  }

  async setupAccountNotMatchingTest() {
    const unmatchAccount = await this.wallet.unlock(
      this.sender.index + 1,
      Config.wallet.defaultAccountType,
    );

    this.getWalletSpy.mockReset().mockResolvedValue({
      account: {
        ...this.keyringAccount,
        address: unmatchAccount.address,
      },
      hdPath: `m/0'/0/${this.sender.index}`,
      index: this.sender.index,
      scope: this.testCase.caip2ChainId,
    });
  }
}

export class EstimateFeeTest extends AccountTest {
  testCase: EstimateFeeTestCreateOption;

  getFeeRatesSpy: jest.SpyInstance;

  getDataForTransactionSpy: jest.SpyInstance;

  utxos: {
    list: Utxo[];
    total: number;
  };

  constructor(testCase: EstimateFeeTestCreateOption) {
    super(testCase);
    const { getDataForTransactionSpy, getFeeRatesSpy } =
      createMockChainApiFactory();
    this.getFeeRatesSpy = getFeeRatesSpy;
    this.getDataForTransactionSpy = getDataForTransactionSpy;
    this.utxos = {
      list: [],
      total: 0,
    };
  }

  protected createUtxos() {
    const { data: utxoDataList, total: utxoTotalValue } =
      createMockGetDataForTransactionResp(
        this.sender.address,
        this.testCase.utxoCount,
        this.testCase.utxoMinVal,
        this.testCase.utxoMaxVal,
      );
    this.utxos.list = utxoDataList;
    this.utxos.total = utxoTotalValue;
    this.getDataForTransactionSpy.mockResolvedValue({
      data: {
        utxos: this.utxos.list,
      },
    });
  }

  async setup() {
    await super.setup();

    this.createUtxos();

    this.getFeeRatesSpy.mockResolvedValue({
      fees: [
        {
          type: Config.defaultFeeRate,
          rate: BigInt(this.testCase.feeRate),
        },
      ],
    });
  }

  async setupNoFeeAvailableTest() {
    this.getFeeRatesSpy.mockReset().mockResolvedValue({
      fees: [],
    });
  }
}

export class GetMaxSpendableBalanceTest extends EstimateFeeTest {}

export class SendBitcoinTest extends EstimateFeeTest {
  recipients: BtcAccount[];

  testCase: SendBitcoinCreateOption;

  broadcastTransactionSpy: jest.SpyInstance;

  confirmDialogSpy: jest.SpyInstance;

  alertDialogSpy: jest.SpyInstance;

  #broadCastTxResp: string | null;

  constructor(testCase: SendBitcoinCreateOption) {
    super(testCase);
    const { broadcastTransactionSpy } = createMockChainApiFactory();
    this.broadcastTransactionSpy = broadcastTransactionSpy;
    this.confirmDialogSpy = createMockConfirmDialog();
    this.alertDialogSpy = createMockAlertDialog();
  }

  async setup() {
    await super.setup();
    this.recipients = await this.createMockRecipients(
      this.testCase.recipientCount,
    );
    this.broadcastTransactionSpy.mockResolvedValue({
      transactionId: this.broadCastTxResp,
    });
    // expect to be override by the test case
    this.confirmDialogSpy.mockResolvedValue(true);
    this.alertDialogSpy.mockReturnThis();
  }

  async setupUserDeniedTest() {
    this.confirmDialogSpy.mockReset().mockResolvedValue(false);
  }

  async setupInsufficientFundsTest() {
    this.getDataForTransactionSpy.mockReset().mockResolvedValue({
      data: {
        utxos: [],
      },
    });
  }

  async createMockRecipients(recipientCount: number) {
    const recipients: BtcAccount[] = [];
    for (let i = 1; i < recipientCount + 1; i++) {
      recipients.push(
        await this.wallet.unlock(i, Config.wallet.defaultAccountType),
      );
    }
    return recipients;
  }

  get broadCastTxResp() {
    if (!this.#broadCastTxResp) {
      this.#broadCastTxResp = generateQuickNodeSendRawTransactionResp().result;
    }
    return this.#broadCastTxResp;
  }
}

export class StartSendTransactionFlowTest extends SendBitcoinTest {
  generateSendFlowSpy: jest.SpyInstance;

  updateSendFlowSpy: jest.SpyInstance;

  generateConfirmationReviewInterfaceSpy: jest.SpyInstance;

  getBalancesSpy: jest.SpyInstance;

  snapRequestSpy: jest.SpyInstance;

  getRequestSpy: jest.SpyInstance;

  upsertRequestSpy: jest.SpyInstance;

  createSendUIDialogMock: jest.SpyInstance;

  getBalanceAndRatesSpy: jest.SpyInstance;

  scope: string;

  requestId = 'mock-requestId';

  interfaceId = 'mock-interfaceId';

  constructor(testCase: SendBitcoinCreateOption) {
    super(testCase);
    this.scope = testCase.caip2ChainId;
    const mocks = createMockSendFlow();
    const { getBalancesSpy } = createMockChainApiFactory();
    this.getBalancesSpy = getBalancesSpy;
    this.generateSendFlowSpy = mocks.generateSendFlowSpy;
    this.updateSendFlowSpy = mocks.updateSendFlowSpy;
    this.generateConfirmationReviewInterfaceSpy =
      mocks.generateConfirmationReviewInterfaceSpy;
    this.createSendUIDialogMock = createSendUIDialogMock();
    const { getRequestSpy, upsertRequestSpy } = createRequestMocks(
      generateDefaultSendFlowRequest(
        this.keyringAccount,
        this.scope,
        this.requestId,
        this.interfaceId,
      ),
    );
    this.upsertRequestSpy = upsertRequestSpy;
    this.getRequestSpy = getRequestSpy;
    this.getBalanceAndRatesSpy = createRatesAndBalancesMock();
  }

  async setup() {
    await super.setup();
    this.snapRequestSpy = jest.spyOn(snap, 'request').mockResolvedValue(true);
    this.broadcastTransactionSpy.mockResolvedValue({
      transactionId: this.broadCastTxResp,
    });
    // expect to be override by the test case
    const sendFlowRequest = generateDefaultSendFlowRequest(
      this.keyringAccount,
      this.scope,
      this.requestId,
      this.interfaceId,
    );

    this.generateSendFlowSpy.mockResolvedValue(sendFlowRequest);
    this.updateSendFlowSpy.mockResolvedValue(true);
    this.generateConfirmationReviewInterfaceSpy.mockResolvedValue(true);
    this.getBalancesSpy.mockResolvedValue({
      balances: {
        [this.keyringAccount.address]: {
          [Caip19Asset.TBtc]: {
            amount: '100000000',
          },
          [Caip19Asset.Btc]: {
            amount: '100000000',
          },
        },
      },
    });
    this.createSendUIDialogMock.mockResolvedValue(true);
    this.getBalanceAndRatesSpy.mockResolvedValue({
      rates: {
        value: '62000',
        error: '',
      },
      balances: {
        value: {
          [Caip19Asset.TBtc]: {
            amount: '1',
          },
          [Caip19Asset.Btc]: {
            amount: '1',
          },
          error: '',
        },
      },
    });
  }

  async setupMockRequest(sendFlowRequest: SendFlowRequest): Promise<void> {
    this.generateSendFlowSpy.mockReset().mockResolvedValue(sendFlowRequest);
  }

  async setupSnapRequestSpy(result: any): Promise<void> {
    this.snapRequestSpy.mockReset().mockResolvedValue(result);
  }

  async setupGetRequest(sendFlowRequest: SendFlowRequest): Promise<void> {
    this.getRequestSpy.mockReset().mockResolvedValue(sendFlowRequest);
  }

  async rejectSnapRequest(): Promise<void> {
    this.snapRequestSpy.mockResolvedValue(false);
  }
}
