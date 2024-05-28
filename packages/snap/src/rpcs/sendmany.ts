import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import {
  object,
  string,
  assign,
  type Infer,
  record,
  array,
  boolean,
  assert,
} from 'superstruct';

import {
  TransactionIntentStruct,
  type Fees,
  type IOnChainService,
  type TransactionIntent,
} from '../chain';
import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { btcToSats, satsToBtc } from '../modules/bitcoin/utils';
import { logger } from '../modules/logger/logger';
import {
  SnapRpcHandlerRequestStruct,
  BaseSnapRpcHandler,
} from '../modules/rpc';
import type { IStaticSnapRpcHandler } from '../modules/rpc';
import { SnapHelper } from '../modules/snap';
import type { StaticImplements } from '../types/static';
import { positiveStringStruct } from '../utils';
import type { IAccount, IWallet } from '../wallet';

export type SendManyParams = Infer<typeof SendManyHandler.requestStruct>;

export type SendManyResponse = Infer<typeof SendManyHandler.responseStruct>;

export type TxnJson = {
  feeRate: number;
  estimatedFee: number;
  sender: string;
  recipients: {
    address: string;
    value: number;
  }[];
  changes: {
    address: string;
    value: number;
  }[];
};

export class SendManyHandler
  extends BaseSnapRpcHandler
  implements StaticImplements<IStaticSnapRpcHandler, typeof SendManyHandler>
{
  protected override isThrowValidationError = true;

  walletData: WalletData;

  wallet: IWallet;

  walletAccount: IAccount;

  transactionIntent: TransactionIntent;

  constructor(walletData: WalletData) {
    super();
    this.walletData = walletData;
  }

  static override get requestStruct() {
    return assign(
      object({
        amounts: record(string(), positiveStringStruct),
        comment: string(),
        subtractFeeFrom: array(string()),
        replaceable: boolean(),
        dryrun: boolean(),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    return object({
      txId: string(),
    });
  }

  protected override async preExecute(params: SendManyParams): Promise<void> {
    await super.preExecute(params);
    const transactionIntent = this.formatTxnIndents(params);
    try {
      assert(transactionIntent, TransactionIntentStruct);
    } catch (error) {
      this.throwValidationError(error.message);
    }

    const { scope, index, account } = this.walletData;
    const wallet = Factory.createWallet(scope);
    const unlocked = await wallet.unlock(index, account.type);

    if (!unlocked || unlocked.address !== account.address) {
      throw new Error('Account not found');
    }

    this.transactionIntent = transactionIntent;
    this.walletAccount = unlocked;
    this.wallet = wallet;
  }

  async handleRequest(params: SendManyParams): Promise<SendManyResponse> {
    const { scope } = this.walletData;
    const { dryrun } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);

    const feesResp = await chainApi.estimateFees();

    const fee = await this.getFeeConsensus(feesResp);

    const metadata = await chainApi.getDataForTransaction(
      this.walletAccount.address,
      this.transactionIntent,
    );

    const { txn, txnJson } = await this.wallet.createTransaction(
      this.walletAccount,
      this.transactionIntent,
      {
        utxos: metadata.data.utxos,
        fee,
        subtractFeeFrom: params.subtractFeeFrom,
        replaceable: params.replaceable,
      },
    );

    if (!(await this.getTxnConsensus(txnJson as unknown as TxnJson))) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    const txnHash = await this.wallet.signTransaction(
      this.walletAccount.signer,
      txn,
    );

    if (dryrun) {
      return {
        txId: txnHash,
      };
    }

    return {
      txId: await this.broadcastTransaction(chainApi, txnHash),
    };
  }

  protected formatTxnIndents(params: SendManyParams): TransactionIntent {
    const { amounts, subtractFeeFrom, replaceable } = params;
    return {
      amounts: Object.entries(amounts).reduce((acc, [address, amount]) => {
        acc[address] = parseInt(btcToSats(parseFloat(amount)), 10);
        return acc;
      }, {}),
      subtractFeeFrom,
      replaceable,
    };
  }

  protected async getFeeConsensus(fees: Fees): Promise<number> {
    // TODO: Ask user to confirm fee
    return fees.fees[fees.fees.length - 1].rate;
  }

  protected async getTxnConsensus(txnJson: TxnJson): Promise<boolean> {
    return (await SnapHelper.confirmDialog(
      'Do you want to send this transaction?',
      'Transaction details',
      [
        {
          label: 'Fee Rate',
          value: satsToBtc(txnJson.feeRate),
        },
        {
          label: 'Estimated Fee',
          value: satsToBtc(txnJson.estimatedFee),
        },
        {
          label: 'Sender',
          value: txnJson.sender,
        },
        {
          label: 'Recipients',
          value: txnJson.recipients.map(({ address, value }) => ({
            label: address,
            value: satsToBtc(value),
          })),
        },
        {
          label: 'Changes',
          value: txnJson.changes.map(({ address, value }) => ({
            label: address,
            value: satsToBtc(value),
          })),
        },
      ],
    )) as boolean;
  }

  protected async broadcastTransaction(
    chainApi: IOnChainService,
    txnHash: string,
  ): Promise<string> {
    try {
      return (await chainApi.broadcastTransaction(txnHash)).transactionId;
    } catch (error) {
      logger.error('Failed to broadcast transaction', error);
      throw new Error('Failed to commit transaction on chain');
    }
  }
}
