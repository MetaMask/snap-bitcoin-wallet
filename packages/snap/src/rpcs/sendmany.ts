import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
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
  refine,
} from 'superstruct';

import { btcToSats } from '../bitcoin/utils';
import { TransactionValidationError } from '../bitcoin/wallet';
import { type TransactionIntent } from '../chain';
import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { logger } from '../libs/logger/logger';
import { SnapRpcHandlerRequestStruct } from '../libs/rpc';
import type { IStaticSnapRpcHandler } from '../libs/rpc';
import { SnapHelper } from '../libs/snap';
import type { StaticImplements } from '../types/static';
import type { IAccount, ITransactionInfo, IWallet } from '../wallet';
import { KeyringRpcHandler } from './keyring-rpc';

export type SendManyParams = Infer<typeof SendManyHandler.requestStruct>;

export type SendManyResponse = Infer<typeof SendManyHandler.responseStruct>;

export const TransactionAmountStuct = refine(
  record(BtcP2wpkhAddressStruct, string()),
  'TransactionAmountStuct',
  (value: Record<string, string>) => {
    if (Object.entries(value).length === 0) {
      return 'Transaction must have at least one recipient';
    }

    for (const val of Object.values(value)) {
      const parsedVal = parseFloat(val);
      if (Number.isNaN(parsedVal) || parsedVal <= 0) {
        return 'Invalid amount for send';
      }
    }

    return true;
  },
);

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
        amounts: TransactionAmountStuct,
        comment: string(),
        subtractFeeFrom: array(BtcP2wpkhAddressStruct),
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
    this.transactionIntent = transactionIntent;
  }

  async handleRequest(params: SendManyParams): Promise<SendManyResponse> {
    try {
      const { scope } = this.walletData;
      const { dryrun } = params;
      const chainApi = Factory.createOnChainServiceProvider(scope);

      const feesResp = await chainApi.getFeeRates();

      if (feesResp.fees.length === 0) {
        throw new Error('No fee rates available');
      }

      const fee = Math.max(
        feesResp.fees[feesResp.fees.length - 1].rate.value,
        1,
      );

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

      const result = await chainApi.broadcastTransaction(txnHash);

      return {
        txId: result.transactionId,
      };
    } catch (error) {
      logger.error('Failed to send the transaction', error);
      if (
        error instanceof TransactionValidationError ||
        error instanceof UserRejectedRequestError
      ) {
        throw error as unknown as Error;
      }
      throw new Error('Failed to send the transaction');
    }
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
}
