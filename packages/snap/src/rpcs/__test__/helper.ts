import type { KeyringAccount } from '@metamask/keyring-api';
import { v4 as uuidV4 } from 'uuid';

import {
  generateBlockChairBroadcastTransactionResp,
  generateBlockChairGetUtxosResp,
} from '../../../test/utils';
import type { Utxo } from '../../bitcoin/chain';
import { BtcOnChainService } from '../../bitcoin/chain';
import type { BtcAccount, BtcWallet } from '../../bitcoin/wallet';
import { Config } from '../../config';
import { Factory } from '../../factory';
import { KeyringStateManager } from '../../stateManagement';

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

  return {
    getDataForTransactionSpy,
    broadcastTransactionSpy,
    getTransactionStatusSpy,
    getBalancesSpy,
    getFeeRatesSpy,
  };
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
  const mockResponse = generateBlockChairGetUtxosResp(
    address,
    counter,
    minVal,
    maxVal,
  );

  let total = 0;
  const data = mockResponse.data[address].utxo.map((utxo) => {
    const { value } = utxo;
    total += value;
    return {
      block: utxo.block_id,
      txHash: utxo.transaction_hash,
      index: utxo.index,
      value,
    };
  });

  return {
    data,
    total,
  };
}

/**
 * Create a mock keyringAccount.
 *
 * @param account - The BtcAccount object.
 * @param caip2ChainId - The Caip2 Chain ID.
 * @returns The keyringAccount and getWalletSpy.
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
    methods: ['btc_sendmany'],
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

export type AccountTestCreateOption = {
  caip2ChainId: string;
};

export type EstimateFeeTestCreateOption = {
  feeRate: number;
  utxoCount: number;
  utxoMinVal: number;
  utxoMaxVal: number;
  caip2ChainId: string;
};

export type SendManyCreateOption = EstimateFeeTestCreateOption & {
  recipientCnt: number;
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
    this.wallet = Factory.createWallet(caip2ChainId);
    this.sender = await this.wallet.unlock(0, Config.wallet.defaultAccountType);

    const { keyringAccount, getWalletSpy } = await createMockKeyringAccount(
      this.sender,
      caip2ChainId,
    );

    this.keyringAccount = keyringAccount;
    this.getWalletSpy = getWalletSpy;

  }

  async createAccountNotFoundTest() {
    this.getWalletSpy.mockReset().mockResolvedValue(null);
  }

  async createAccountNotMatchTest() {
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
    super({
      caip2ChainId: testCase.caip2ChainId,
    });
    this.testCase = testCase;
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

  async createNoFeeAvailableTest() {
    this.getFeeRatesSpy.mockReset().mockResolvedValue({
      fees: [],
    });
  }
}

export class GetMaxSpendableBalanceTest extends EstimateFeeTest { }

export class SendManyTest extends EstimateFeeTest {
  recipients: BtcAccount[];

  testCase: SendManyCreateOption;

  broadcastTransactionSpy: jest.SpyInstance;

  constructor(testCase: SendManyCreateOption) {
    super(testCase);
    const { broadcastTransactionSpy } = createMockChainApiFactory();
    this.broadcastTransactionSpy = broadcastTransactionSpy;
  }

  async setup() {
    await super.setup();
    this.recipients = await this.createMockRecipients(
      this.testCase.recipientCnt,
    );
    this.broadcastTransactionSpy.mockResolvedValue({
      transactionId: this.broadCastTxResp,
    });
  }

  async createMockRecipients(recipientCnt: number) {
    const recipients: BtcAccount[] = [];
    for (let i = 1; i < recipientCnt + 1; i++) {
      recipients.push(
        await this.wallet.unlock(i, Config.wallet.defaultAccountType),
      );
    }
    return recipients;
  }

  get broadCastTxResp() {
    return generateBlockChairBroadcastTransactionResp().data.transaction_hash;
  }
}
