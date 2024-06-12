import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';

import { bufferToString, compactError, hexToBuffer, logger } from '../../utils';
import type {
  IAccountSigner,
  IWallet,
  Recipient,
  Transaction,
} from '../../wallet';
import type { Utxo } from '../chain';
import { ScriptType } from '../constants';
import { isDust, getScriptForDestnation } from '../utils';
import {
  P2WPKHAccount,
  P2SHP2WPKHAccount,
  type IStaticBtcAccount,
  type IBtcAccount,
} from './account';
import { CoinSelectService } from './coin-select';
import type { BtcAccountDeriver } from './deriver';
import { WalletError, TxValidationError } from './exceptions';
import { PsbtService } from './psbt';
import { AccountSigner } from './signer';
import { BtcTxInfo } from './transaction-info';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';

export type CreateTransactionOptions = {
  utxos: Utxo[];
  fee: number;
  subtractFeeFrom: string[];
  //
  // BIP125 opt-in RBF flag,
  //
  replaceable: boolean;
};

export class BtcWallet implements IWallet {
  protected readonly _deriver: BtcAccountDeriver;

  protected readonly _network: Network;

  constructor(deriver: BtcAccountDeriver, network: Network) {
    this._deriver = deriver;
    this._network = network;
  }

  async unlock(index: number, type?: string): Promise<IBtcAccount> {
    try {
      const AccountCtor = this.getAccountCtor(type ?? ScriptType.P2wpkh);
      const rootNode = await this._deriver.getRoot(AccountCtor.path);
      const childNode = await this._deriver.getChild(rootNode, index);
      const hdPath = [`m`, `0'`, `0`, `${index}`].join('/');

      return new AccountCtor(
        bufferToString(rootNode.fingerprint, 'hex'),
        index,
        hdPath,
        bufferToString(childNode.publicKey, 'hex'),
        this._network,
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
  ): Promise<Transaction> {
    const scriptOutput = account.script;
    const { scriptType } = account;

    // TODO: Supporting getting coins from other address (dynamic address)
    const inputs = options.utxos.map((utxo) => new TxInput(utxo, scriptOutput));
    const outputs = recipients.map((recipient) => {
      if (isDust(recipient.value, scriptType)) {
        throw new TxValidationError('Transaction amount too small');
      }
      const destnationScriptOutput = getScriptForDestnation(
        recipient.address,
        this._network,
      );
      return new TxOutput(
        recipient.value,
        recipient.address,
        destnationScriptOutput,
      );
    });

    // Do not ever accept zero fee rate, we need to ensure it is at least 1
    // TODO: The min fee rate should be setting from parameter
    const feeRate = Math.max(1, options.fee);
    const coinSelectService = new CoinSelectService(feeRate);
    const change = new TxOutput(0, account.address, scriptOutput);
    const selectionResult = coinSelectService.selectCoins(
      inputs,
      outputs,
      change,
    );

    const psbtService = new PsbtService(this._network);
    psbtService.addInputs(
      selectionResult.inputs,
      options.replaceable,
      account.hdPath,
      hexToBuffer(account.pubkey, false),
      hexToBuffer(account.mfp, false),
    );

    const txInfo = new BtcTxInfo(account.address, feeRate);

    // TODO: add support of subtractFeeFrom, and throw error if output is too small after subtraction
    for (const output of selectionResult.outputs) {
      psbtService.addOutput(output);
      txInfo.addRecipient(output);
    }

    if (selectionResult.change) {
      if (isDust(change.value, scriptType)) {
        logger.warn(
          '[BtcWallet.createTransaction] Change is too small, adding to fees',
        );
      } else {
        psbtService.addOutput(selectionResult.change);
        txInfo.addChange(selectionResult.change);
      }
    }

    // Sign dummy transaction to extract the fee which is more accurate
    const signedService = await psbtService.signDummy(account.signer);
    txInfo.txFee = signedService.getFee();

    return {
      tx: psbtService.toBase64(),
      txInfo,
    };
  }

  async signTransaction(signer: IAccountSigner, tx: string): Promise<string> {
    const psbtService = PsbtService.fromBase64(this._network, tx);
    await psbtService.signNVerify(signer);
    return psbtService.finalize();
  }

  protected getHdSigner(rootNode: BIP32Interface) {
    return new AccountSigner(rootNode, rootNode.fingerprint);
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
}
