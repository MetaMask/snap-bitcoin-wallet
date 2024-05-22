import type { Json } from '@metamask/snaps-sdk';
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
import { btcToSats } from '../modules/bitcoin/utils/unit';
import type { Fees } from '../modules/chain';
import { type TransactionIntent } from '../modules/chain';
import {
  SnapRpcHandlerRequestStruct,
  BaseSnapRpcHandler,
} from '../modules/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerRequest,
  SnapRpcHandlerResponse,
} from '../modules/rpc';
import type { IAccount, IWallet } from '../modules/wallet';
import type { StaticImplements } from '../types/static';
import { numberStringStruct } from '../utils';

export type SendManyParams = Infer<typeof SendManyHandler.requestStruct>;

export type SendManyResponse = SnapRpcHandlerResponse;

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

    const feesResp = await chainApi.estimateFees();

    const fee = await this.getFeeConsensus(feesResp);

    const metadata = await chainApi.getDataForTransaction(
      this.walletAccount.address,
      transactionIntent,
    );

    const { txn, txnJson } = await this.wallet.createTransaction(
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
    console.log(fees);
    return 1.6; // fees.fees[fees.fees.length-1].rate;
  }

  protected async getTxnConsensus(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    txnJson: Record<string, Json>,
  ): Promise<boolean> {
    console.log(txnJson);
    // TODO: Ask user to confirm txn
    return true;
  }
}
