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

import { TxValidationError } from '../bitcoin/wallet';
import { Factory } from '../factory';
import {
  scopeStruct,
  confirmDialog,
  isSnapRpcError,
  shortenAddress,
  getExplorerUrl,
  btcToSats,
  satsToBtc,
  validateRequest,
  validateResponse,
  logger,
} from '../utils';
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
      Number(feesResp.fees[feesResp.fees.length - 1].rate),
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

    if (!(await getTxConsensus(txInfo, params.comment, scope))) {
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
 * @param info - The transaction data object contains the transaction information.
 * @param comment - The comment text to display.
 * @param scope - The CAIP-2 Chain ID.
 * @returns A Promise that resolves to the response of the confirmation dialog.
 */
export async function getTxConsensus(
  info: ITxInfo,
  comment: string,
  scope: string,
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

  const isMoreThanOneRecipient =
    info.recipients.length + (info.change ? 1 : 0) > 1;

  let i = 0;

  const addReciptentsToComponents = (data: {
    address: string;
    value: bigint;
  }) => {
    const recipientsPanel: Component[] = [];
    recipientsPanel.push(
      row(
        isMoreThanOneRecipient
          ? `${recipientsLabel} ${i + 1}`
          : recipientsLabel,
        text(
          `[${shortenAddress(data.address)}](${getExplorerUrl(
            data.address,
            scope,
          )})`,
        ),
      ),
    );
    recipientsPanel.push(
      row(amountLabel, text(satsToBtc(data.value, true), false)),
    );
    i += 1;
    components.push(panel(recipientsPanel));
    components.push(divider());
  };

  info.recipients.forEach(addReciptentsToComponents);

  if (info.change) {
    [info.change].forEach(addReciptentsToComponents);
  }

  const bottomPanel: Component[] = [];
  if (comment.trim().length > 0) {
    bottomPanel.push(row(commentLabel, text(comment.trim(), false)));
  }

  bottomPanel.push(
    row(networkFeeLabel, text(`${satsToBtc(info.txFee, true)}`, false)),
  );

  // bottomPanel.push(row(networkFeeRateLabel, text(`${info.feeRate}`, false)));

  bottomPanel.push(
    row(totalLabel, text(`${satsToBtc(info.total, true)}`, false)),
  );

  components.push(panel(bottomPanel));

  return (await confirmDialog(components)) as boolean;
}
