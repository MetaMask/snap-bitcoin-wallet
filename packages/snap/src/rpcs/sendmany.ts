import type { Component } from '@metamask/snaps-sdk';
import {
  UserRejectedRequestError,
  divider,
  text,
  heading,
  row,
} from '@metamask/snaps-sdk';
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
  type IOnChainService,
  type TransactionIntent,
} from '../chain';
import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { btcToSats } from '../modules/bitcoin/utils';
import { logger } from '../modules/logger/logger';
import { SnapRpcHandlerRequestStruct } from '../modules/rpc';
import type { IStaticSnapRpcHandler } from '../modules/rpc';
import { SnapHelper } from '../modules/snap';
import type { StaticImplements } from '../types/static';
import { positiveStringStruct } from '../utils';
import type { IAccount, ITransactionInfo, IWallet } from '../wallet';
import { KeyringRpcHandler } from './keyring-rpc';

export type SendManyParams = Infer<typeof SendManyHandler.requestStruct>;

export type SendManyResponse = Infer<typeof SendManyHandler.responseStruct>;

export type TxnJson = {
  feeRate: string;
  txnFee: string;
  total: string;
  sender: string;
  recipients: {
    address: string;
    explorerUrl: string;
    value: string;
  }[];
  changes: {
    address: string;
    value: string;
  }[];
};

export class SendManyHandler
  extends KeyringRpcHandler
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
    this.transactionIntent = transactionIntent;
  }

  async handleRequest(params: SendManyParams): Promise<SendManyResponse> {
    const { scope } = this.walletData;
    const { dryrun } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);

    const feesResp = await chainApi.getFeeRates();

    if (feesResp.fees.length === 0) {
      throw new Error('No fee rates available');
    }

    const fee = Math.max(feesResp.fees[feesResp.fees.length - 1].rate.value, 1);

    const metadata = await chainApi.getDataForTransaction(
      this.walletAccount.address,
      this.transactionIntent,
    );

    const { txn, txnInfo } = await this.wallet.createTransaction(
      this.walletAccount,
      this.transactionIntent,
      {
        utxos: metadata.data.utxos,
        fee,
        subtractFeeFrom: params.subtractFeeFrom,
        replaceable: params.replaceable,
      },
    );

    if (!(await this.getTxnConsensus(txnInfo, params.comment))) {
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

  protected async getTxnConsensus(
    txnInfo: ITransactionInfo,
    comment: string,
  ): Promise<boolean> {
    const header = `Send Request`;
    const intro = `Review the request by [portfolio.metamask.io](https://portfolio.metamask.io/) before proceeding. Once the transaction is made, it's irreversible.`;
    const recipientsLabel = `Recipient`;
    const amountLabel = `Amount`;
    const commentLabel = `Comment`;
    const networkFeeRateLabel = `Network fee rate`;
    const networkFeeLabel = `Network fee`;
    const totalLabel = `Total`;

    const components: Component[] = [heading(header), text(intro), divider()];
    const info = txnInfo.toJson<TxnJson>();

    const isMoreThanOneRecipient =
      info.recipients.length + info.changes.length > 1;

    let i = 0;

    const addReceiptentsToComponents = (data: {
      address: string;
      explorerUrl: string;
      value: string;
    }) => {
      components.push(
        row(
          isMoreThanOneRecipient
            ? `${recipientsLabel} ${i + 1}`
            : recipientsLabel,
          text(`[${data.address}](${data.explorerUrl})`),
        ),
      );
      components.push(row(amountLabel, text(data.value, false)));
      components.push(divider());
      i += 1;
    };

    info.recipients.forEach(addReceiptentsToComponents);
    info.changes.forEach(addReceiptentsToComponents);

    if (comment.trim().length > 0) {
      components.push(row(commentLabel, text(comment.trim())));
    }

    components.push(row(networkFeeLabel, text(`${info.txnFee}`, false)));

    components.push(row(networkFeeRateLabel, text(`${info.feeRate}`, false)));

    components.push(row(totalLabel, text(`${info.total}`, false)));

    return (await SnapHelper.confirmDialog(components)) as boolean;
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
