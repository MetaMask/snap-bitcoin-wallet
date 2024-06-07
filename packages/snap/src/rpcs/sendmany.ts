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
import { logger } from '../logger';
import { scopeStruct, confirmDialog, isSnapRpcError } from '../utils';
import { validateRequest, validateResponse } from '../utils/rpc';
import type { IAccount, ITxInfo } from '../wallet';

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

      try {
        btcToSats(val);
      } catch (error) {
        return 'Invalid amount for send';
      }
    }

    return true;
  },
);

export const sendManyParamsStruct = object({
  amounts: TransactionAmountStuct,
  comment: string(),
  subtractFeeFrom: array(BtcP2wpkhAddressStruct),
  replaceable: boolean(),
  dryrun: optional(boolean()),
  scope: scopeStruct,
});

export const sendManyResponseStruct = object({
  txId: string(),
  txHash: optional(string()),
});

export type SendManyParams = Infer<typeof sendManyParamsStruct>;

export type SendManyResponse = Infer<typeof sendManyResponseStruct>;

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

/**
 * Send BTC to multiple account.
 *
 * @param account - The account to send the transaction.
 * @param params - The parameters for send the transaction.
 * @returns A Promise that resolves to an SendManyResponse object.
 */
export async function sendMany(account: IAccount, params: SendManyParams) {
  try {
    validateRequest(params, sendManyParamsStruct);

    const { dryrun, scope } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);
    const wallet = Factory.createWallet(scope);

    const feesResp = await chainApi.getFeeRates();

    if (feesResp.fees.length === 0) {
      throw new Error('No fee rates available');
    }

    const fee = Math.max(
      Number(feesResp.fees[feesResp.fees.length - 1].rate.value),
      1,
    );

    const recipients = Object.entries(params.amounts).map(
      ([address, value]) => ({
        address,
        value: btcToSats(value),
      }),
    );

    const metadata = await chainApi.getDataForTransaction(account.address);

    const { tx, txInfo } = await wallet.createTransaction(account, recipients, {
      utxos: metadata.data.utxos,
      fee,
      subtractFeeFrom: params.subtractFeeFrom,
      replaceable: params.replaceable,
    });

    if (!(await getTxConsensus(txInfo, params.comment))) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    const txHash = await wallet.signTransaction(account.signer, tx);

    if (dryrun) {
      return {
        txId: '',
        txHash,
      };
    }

    const result = await chainApi.broadcastTransaction(txHash);

    const resp = {
      txId: result.transactionId,
    };

    validateResponse(resp, sendManyResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to send the transaction', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (
      error instanceof TxValidationError ||
      error instanceof UserRejectedRequestError
    ) {
      throw error as unknown as Error;
    }

    throw new Error('Failed to send the transaction');
  }
}

/**
 * Display an confirmation dialog to confirm an transaction.
 *
 * @param txInfo - The json transaction data.
 * @param comment - The comment text to display.
 * @returns A Promise that resolves to the response of the confirmation dialog.
 */
export async function getTxConsensus(
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

  return (await confirmDialog(components)) as boolean;
}
