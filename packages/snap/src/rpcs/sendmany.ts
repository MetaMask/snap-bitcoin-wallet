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
  nonempty,
  assert,
} from 'superstruct';

import type { Recipient, Transaction } from '../bitcoin/wallet';
import {
  type BtcAccount,
  type ITxInfo,
  TxValidationError,
  InsufficientFundsError,
} from '../bitcoin/wallet';
import { Factory } from '../factory';
import {
  ScopeStruct,
  confirmDialog,
  isSnapRpcError,
  shortenAddress,
  getExplorerUrl,
  btcToSats,
  satsToBtc,
  validateRequest,
  validateResponse,
  logger,
  AmountStruct,
  getFeeRate,
  alertDialog,
} from '../utils';

export const TransactionAmountStruct = refine(
  record(BtcP2wpkhAddressStruct, string()),
  'TransactionAmountStruct',
  (value: Record<string, string>) => {
    if (Object.entries(value).length === 0) {
      return 'Transaction must have at least one recipient';
    }

    for (const val of Object.values(value)) {
      assert(val, AmountStruct);
    }

    return true;
  },
);

export const SendManyParamsStruct = object({
  amounts: TransactionAmountStruct,
  comment: string(),
  subtractFeeFrom: array(BtcP2wpkhAddressStruct),
  replaceable: boolean(),
  dryrun: optional(boolean()),
  scope: ScopeStruct,
});

export const SendManyResponseStruct = object({
  txId: nonempty(string()),
  signedTransaction: optional(string()),
});

export type SendManyParams = Infer<typeof SendManyParamsStruct>;

export type SendManyResponse = Infer<typeof SendManyResponseStruct>;

/**
 * Send BTC to multiple account.
 *
 * @param account - The account to send the transaction.
 * @param origin - The origin of the request.
 * @param params - The parameters for send the transaction.
 * @returns A Promise that resolves to an SendManyResponse object.
 */
export async function sendMany(
  account: BtcAccount,
  origin: string,
  params: SendManyParams,
) {
  try {
    validateRequest(params, SendManyParamsStruct);

    const { dryrun, scope, subtractFeeFrom, replaceable, comment } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);
    const wallet = Factory.createWallet(scope);

    const feesResp = await chainApi.getFeeRates();

    const fee = getFeeRate(feesResp.fees);

    const recipients = Object.entries(params.amounts).map(
      ([address, value]) => ({
        address,
        value: btcToSats(value),
      }),
    );

    const {
      data: { utxos },
    } = await chainApi.getDataForTransaction(account.address);

    let txResp: Transaction;

    try {
      txResp = await wallet.createTransaction(account, recipients, {
        utxos,
        fee,
        subtractFeeFrom,
        replaceable,
      });
    } catch (createTxError) {
      // Wallet.createTransaction may throw an insufficient funds error
      // And end-user is expected to know about it.
      // Hence we display an alert dialog to indicate the issue.
      if (createTxError instanceof InsufficientFundsError) {
        await displayInsufficientFundsWarning(recipients, scope, origin);
      }
      throw createTxError;
    }

    if (!(await getTxConsensus(txResp.txInfo, comment, scope, origin))) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    const signedTransaction = await wallet.signTransaction(
      account.signer,
      txResp.tx,
    );

    if (dryrun) {
      return {
        txId: '',
        signedTransaction,
      };
    }

    const result = await chainApi.broadcastTransaction(signedTransaction);

    const resp = {
      txId: result.transactionId,
    };

    validateResponse(resp, SendManyResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to send the transaction', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (error instanceof TxValidationError) {
      throw error;
    }

    throw new Error('Failed to send the transaction');
  }
}

/**
 * Display a confirmation dialog to confirm an transaction.
 *
 * @param info - The transaction data object contains the transaction information.
 * @param comment - The comment text to display.
 * @param scope - The CAIP-2 Chain ID.
 * @param origin - The origin of the request.
 * @returns A Promise that resolves to the response of the confirmation dialog.
 */
export async function getTxConsensus(
  info: ITxInfo,
  comment: string,
  scope: string,
  origin: string,
): Promise<boolean> {
  const header = `Send Request`;
  const intro = `Review the request before proceeding. Once the transaction is made, it's irreversible.`;
  const commentLabel = `Comment`;
  // const networkFeeRateLabel = `Network fee rate`;
  const networkFeeLabel = `Network fee`;
  const totalLabel = `Total`;
  const requestedByLabel = `Requested by`;

  let components: Component[] = [
    panel([
      heading(header),
      text(intro),
      row(requestedByLabel, text(`${origin}`, false)),
    ]),
    divider(),
  ];

  components = components.concat(
    buildRecipientsComponent(
      info.change ? info.recipients.concat(info.change) : info.recipients,
      scope,
    ),
  );

  const bottomPanel: Component[] = [];
  const commentText = comment.trim();
  if (commentText.length > 0) {
    bottomPanel.push(row(commentLabel, text(commentText, false)));
  }

  bottomPanel.push(
    row(networkFeeLabel, text(`${satsToBtc(info.txFee, true)}`, false)),
  );

  bottomPanel.push(
    row(totalLabel, text(`${satsToBtc(info.total, true)}`, false)),
  );

  components.push(panel(bottomPanel));

  return (await confirmDialog(components)) as boolean;
}

/**
 * Displays an alert dialog to display the warning message of insufficient funds to pay the transaction.
 *
 * @param recipients - The recipient list of the request.
 * @param scope - The Caip2 Chain Id of the request.
 * @param origin - The origin of the request.
 */
export async function displayInsufficientFundsWarning(
  recipients: Recipient[],
  scope: string,
  origin: string,
): Promise<void> {
  const header = `Send Request`;
  const requestedByLabel = `Requested by`;
  const insufficientFundsMsg = `You do not have enough BTC in your account to pay for transaction amount or transaction fees on Bitcoin network.`;

  let components: Component[] = [
    panel([heading(header), row(requestedByLabel, text(`${origin}`, false))]),
    divider(),
  ];

  components = components.concat(buildRecipientsComponent(recipients, scope));

  components.push(text(`${insufficientFundsMsg}`, false));

  await alertDialog(components);
}

/**
 * Builds a snap component to display the transcation recipient list.
 *
 * @param recipients - The recipient list of request.
 * @param scope - The Caip2 Chain Id of request.
 * @returns An array of Snap component.
 */
export function buildRecipientsComponent(
  recipients: Recipient[],
  scope: string,
): Component[] {
  const recipientsLabel = `Recipient`;
  const amountLabel = `Amount`;

  const recipientsLen = recipients.length;
  const isMoreThanOneRecipient = recipientsLen > 1;

  const components: Component[] = [];
  for (let idx = 0; idx < recipientsLen; idx++) {
    const recipient = recipients[idx];
    const recipientsPanel: Component[] = [];

    recipientsPanel.push(
      row(
        isMoreThanOneRecipient
          ? `${recipientsLabel} ${idx + 1}`
          : recipientsLabel,
        text(
          `[${shortenAddress(recipient.address)}](${getExplorerUrl(
            recipient.address,
            scope,
          )})`,
        ),
      ),
    );
    recipientsPanel.push(
      row(amountLabel, text(satsToBtc(recipient.value, true), false)),
    );

    components.push(panel(recipientsPanel));
    components.push(divider());
  }

  return components;
}
