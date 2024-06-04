import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';

import { logger } from '../../libs/logger/logger';
import { bufferToString, compactError } from '../../utils';
import type {
  IAccountSigner,
  IWallet,
  Recipient,
  TxCreationResult,
} from '../../wallet';
import { ScriptType } from '../constants';
import { isDust } from '../utils';
import { P2WPKHAccount, P2SHP2WPKHAccount } from './account';
import { BtcAddress } from './address';
import { CoinSelectService } from './coin-select';
import { WalletError, TxValidationError } from './exceptions';
import { PsbtService } from './psbt';
import { AccountSigner } from './signer';
import { BtcTxInfo } from './transaction-info';
import { TxInput } from './transaction-input';
import type {
  IStaticBtcAccount,
  IBtcAccountDeriver,
  IBtcAccount,
  CreateTransactionOptions,
} from './types';

export class BtcWallet implements IWallet {
  protected readonly deriver: IBtcAccountDeriver;

  protected readonly network: Network;

  constructor(deriver: IBtcAccountDeriver, network: Network) {
    this.deriver = deriver;
    this.network = network;
  }

  protected getAccountCtor(type: string): IStaticBtcAccount {
    let scriptType = type;
    if (type.includes('bip122:')) {
      scriptType = type.split(':')[1];
    }
    switch (scriptType.toLowerCase()) {
      case ScriptType.P2wpkh.toLowerCase():
        return P2WPKHAccount;
      case ScriptType.P2shP2wkh.toLowerCase():
        return P2SHP2WPKHAccount;
      default:
        throw new WalletError('Invalid script type');
    }
  }

  async unlock(index: number, type: string): Promise<IBtcAccount> {
    try {
      const AccountCtor = this.getAccountCtor(type);
      const rootNode = await this.deriver.getRoot(AccountCtor.path);
      const childNode = await this.deriver.getChild(rootNode, index);
      const hdPath = [`m`, `0'`, `0`, `${index}`].join('/');

      return new AccountCtor(
        bufferToString(rootNode.fingerprint, 'hex'),
        index,
        hdPath,
        bufferToString(childNode.publicKey, 'hex'),
        this.network,
        AccountCtor.scriptType,
        `bip122:${AccountCtor.scriptType.toLowerCase()}`,
        this.getHdSigner(rootNode),
      );
    } catch (error) {
      throw compactError(error, WalletError);
    }
  }

  async createTransaction(
    account: IBtcAccount,
    recipients: Recipient[],
    options: CreateTransactionOptions,
  ): Promise<TxCreationResult> {
    const scriptOutput = account.payment.output;
    const { scriptType } = account;

    if (!scriptOutput) {
      throw new WalletError('Fail to get account script hash');
    }

    // as fee rate can be 0, we need to ensure it is at least 1
    // TODO: The min fee rate should be setting from parameter
    const feeRate = Math.max(1, options.fee);

    const coinSelectService = new CoinSelectService(feeRate);

    const inputs = options.utxos.map((utxo) => new TxInput(utxo, scriptOutput));

    const selectionResult = coinSelectService.selectCoins(
      inputs,
      recipients,
      account,
    );

    // TODO: add support of subtractFeeFrom, and throw error if output is too small after subtraction
    for (const output of selectionResult.selectedOutputs) {
      if (isDust(output.value, scriptType)) {
        throw new TxValidationError('Transaction amount too small');
      }
    }

    const psbtOutputs = selectionResult.selectedOutputs;
    const psbtInputs = selectionResult.selectedInputs;

    const info = new BtcTxInfo(
      new BtcAddress(account.address),
      selectionResult.selectedOutputs,
      selectionResult.fee,
      feeRate,
      this.network,
    );

    if (selectionResult.change && selectionResult.change.value > 0) {
      if (isDust(selectionResult.change.value, scriptType)) {
        logger.warn(
          '[BtcWallet.createTransaction] Change is too small, adding to fees',
        );
        info.bumpFee(selectionResult.change.value);
      } else {
        info.change = selectionResult.change;
        psbtOutputs.push(selectionResult.change);
      }
    }

    const psbtService = new PsbtService(this.network);

    psbtService.addInputs(psbtInputs, account, options.replaceable);

    psbtService.addOutputs(psbtOutputs);

    return {
      tx: psbtService.toBase64(),
      txInfo: info,
    };
  }

  async signTransaction(signer: IAccountSigner, tx: string): Promise<string> {
    const psbtService = PsbtService.fromBase64(this.network, tx);
    await psbtService.signNVerify(signer);
    return psbtService.finalize();
  }

  protected getHdSigner(rootNode: BIP32Interface) {
    return new AccountSigner(rootNode, rootNode.fingerprint);
  }
}
