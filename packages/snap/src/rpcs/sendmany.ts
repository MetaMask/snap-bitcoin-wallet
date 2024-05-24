import {
  object,
  string,
  assign,
  type Infer,
  record,
  array,
  boolean,
} from 'superstruct';

import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { btcToSats, satsToBtc } from '../modules/bitcoin/utils/unit';
import type { Fees, IOnChainService } from '../modules/chain';
import { type TransactionIntent } from '../modules/chain';
import { logger } from '../modules/logger/logger';
import {
  SnapRpcHandlerRequestStruct,
  BaseSnapRpcHandler,
} from '../modules/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerRequest,
  SnapRpcHandlerResponse,
} from '../modules/rpc';
import { SnapHelper } from '../modules/snap';
import type { IAccount, IWallet } from '../modules/wallet';
import type { StaticImplements } from '../types/static';
import { numberStringStruct } from '../utils';

export type SendManyParams = Infer<typeof SendManyHandler.requestStruct>;

export type SendManyResponse = SnapRpcHandlerResponse;

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
  walletData: WalletData;

  wallet: IWallet;

  walletAccount: IAccount;

  constructor(walletData: WalletData) {
    super();
    this.walletData = walletData;
  }

  static override get requestStruct() {
    return assign(
      object({
        amounts: record(string(), numberStringStruct),
        comment: string(),
        subtractFeeFrom: array(string()),
        replaceable: boolean(),
        dryrun: boolean(),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  protected override async preExecute(
    params: SnapRpcHandlerRequest,
  ): Promise<void> {
    await super.preExecute(params);

    const { scope, index, account } = this.walletData;
    const wallet = Factory.createWallet(scope);
    const unlocked = await wallet.unlock(index, account.type);
    if (!unlocked || unlocked.address !== account.address) {
      throw new Error('Account not found');
    }

    this.walletAccount = unlocked;
    this.wallet = wallet;
  }

  async handleRequest(params: SendManyParams): Promise<SendManyResponse> {
    const { scope } = this.walletData;
    const { dryrun } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);
    const transactionIntent = this.formatTxnIndents(params);

    const amountsToSend = Object.values(transactionIntent.amounts);

    if (amountsToSend.length === 0) {
      throw new Error('Transaction must have at least one recipient');
    }

    for (const amount of amountsToSend) {
      if (amount <= 0) {
        throw new Error('Invalid amount for send');
      }
    }

    const feesResp = await chainApi.estimateFees();

    const fee = await this.getFeeConsensus(feesResp);

    const metadata = await chainApi.getDataForTransaction(
      this.walletAccount.address,
      transactionIntent,
    );

    const { txn, txnJson } = await this.wallet.createTransaction<TxnJson>(
      this.walletAccount,
      transactionIntent,
      {
        utxos: metadata.data.utxos,
        fee,
      },
    );

    if (!(await this.getTxnConsensus(txnJson))) {
      throw new Error('User denied transaction request');
    }

    const txnHash = await this.wallet.signTransaction(
      this.walletAccount.signer,
      txn,
    );

    if (dryrun) {
      return { txnHash };
    }

    return await chainApi.boardcastTransaction(txnHash);
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

  protected async boardcastTransaction(
    chainApi: IOnChainService,
    txnHash: string,
  ): Promise<SendManyResponse> {
    try {
      return await chainApi.boardcastTransaction(txnHash);
    } catch (error) {
      logger.error('Failed to broadcast transaction', error);
      throw new Error('Failed to commit transaction on chain');
    }
  }
}
