import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { Component } from '@metamask/snaps-sdk';
import {
  UserRejectedRequestError,
  divider,
  text,
  heading,
  row,
  panel,
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
  optional,
} from 'superstruct';

import { btcToSats } from '../bitcoin/utils';
import { TxValidationError } from '../bitcoin/wallet';
import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { logger } from '../libs/logger/logger';
import { SnapRpcHandlerRequestStruct } from '../libs/rpc';
import type { IStaticSnapRpcHandler } from '../libs/rpc';
import { SnapHelper } from '../libs/snap';
import type { StaticImplements } from '../types/static';
import type { ITxInfo } from '../wallet';
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
      if (
        Number.isNaN(parsedVal) ||
        parsedVal <= 0 ||
        !Number.isFinite(parsedVal)
      ) {
        return 'Invalid amount for send';
      }
    }

    return true;
  },
);

export type TxJson = {
  feeRate: string;
  txFee: string;
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
    explorerUrl: string;
  }[];
};

export class SendManyHandler
  extends KeyringRpcHandler
  implements StaticImplements<IStaticSnapRpcHandler, typeof SendManyHandler>
{
  protected override isThrowValidationError = true;

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
      txHash: optional(string()),
    });
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

      const recipients = Object.entries(params.amounts).map(
        ([address, value]) => ({
          address,
          value: parseInt(btcToSats(parseFloat(value)), 10),
        }),
      );

      const metadata = await chainApi.getDataForTransaction(
        this.walletAccount.address,
      );

      const { tx, txInfo } = await this.wallet.createTransaction(
        this.walletAccount,
        recipients,
        {
          utxos: metadata.data.utxos,
          fee,
          subtractFeeFrom: params.subtractFeeFrom,
          replaceable: params.replaceable,
        },
      );

      if (!(await this.getTxConsensus(txInfo, params.comment))) {
        throw new UserRejectedRequestError() as unknown as Error;
      }

      const txHash = await this.wallet.signTransaction(
        this.walletAccount.signer,
        tx,
      );

      if (dryrun) {
        return {
          txId: '',
          txHash,
        };
      }

      const result = await chainApi.broadcastTransaction(txHash);

      return {
        txId: result.transactionId,
      };
    } catch (error) {
      logger.error('Failed to send the transaction', error);
      if (
        error instanceof TxValidationError ||
        error instanceof UserRejectedRequestError
      ) {
        throw error as unknown as Error;
      }
      throw new Error('Failed to send the transaction');
    }
  }

  protected async getTxConsensus(
    txInfo: ITxInfo,
    comment: string,
  ): Promise<boolean> {
    const header = `Send Request`;
    const intro = `Review the request before proceeding. Once the transaction is made, it's irreversible.`;
    const recipientsLabel = `Recipient`;
    const amountLabel = `Amount`;
    const commentLabel = `Comment`;
    // const networkFeeRateLabel = `Network fee rate`;
    const networkFeeLabel = `Network fee`;
    const totalLabel = `Total`;
    const requestedByLable = `Requested by`;

    const components: Component[] = [
      panel([
        heading(header),
        text(intro),
        row(
          requestedByLable,
          text(`[portfolio.metamask.io](https://portfolio.metamask.io/)`),
        ),
      ]),
      divider(),
    ];

    const info = txInfo.toJson<TxJson>();

    const isMoreThanOneRecipient =
      info.recipients.length + info.changes.length > 1;

    let i = 0;

    const addReciptentsToComponents = (data: {
      address: string;
      explorerUrl: string;
      value: string;
    }) => {
      const recipientsPanel: Component[] = [];
      recipientsPanel.push(
        row(
          isMoreThanOneRecipient
            ? `${recipientsLabel} ${i + 1}`
            : recipientsLabel,
          text(`[${data.address}](${data.explorerUrl})`),
        ),
      );
      recipientsPanel.push(row(amountLabel, text(data.value, false)));
      i += 1;
      components.push(panel(recipientsPanel));
      components.push(divider());
    };

    info.recipients.forEach(addReciptentsToComponents);
    info.changes.forEach(addReciptentsToComponents);

    const bottomPanel: Component[] = [];
    if (comment.trim().length > 0) {
      bottomPanel.push(row(commentLabel, text(comment.trim(), false)));
    }

    bottomPanel.push(row(networkFeeLabel, text(`${info.txFee}`, false)));

    // bottomPanel.push(row(networkFeeRateLabel, text(`${info.feeRate}`, false)));

    bottomPanel.push(row(totalLabel, text(`${info.total}`, false)));

    components.push(panel(bottomPanel));

    return (await SnapHelper.confirmDialog(components)) as boolean;
  }
}
