import type { BIP32Interface } from 'bip32';
import { networks, type Network } from 'bitcoinjs-lib';
import { type Buffer } from 'buffer';

import { Factory } from '../../factory';
import { bufferToString, compactError, hexToBuffer, logger } from '../../utils';
import type { BtcOnChainService, Utxo } from '../chain';
import type { BtcAccount } from './account';
import {
  P2WPKHAccount,
  P2WPKHTestnetAccount,
  type IStaticBtcAccount,
} from './account';
import type { SelectionResult } from './coin-select';
import { CoinSelectService } from './coin-select';
import { ScriptType } from './constants';
import type { BtcAccountDeriver } from './deriver';
import {
  WalletError,
  TransactionDustError,
  InsufficientFundsError,
} from './exceptions';
import { PsbtService } from './psbt';
import { AccountSigner } from './signer';
import { TxInfo } from './transaction-info';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { isDust, getScriptForDestination, getCaip2ChainId } from './utils';

export type Recipient = {
  address: string;
  value: bigint;
};

export type Transaction = {
  tx: string;
  txInfo: ITxInfo;
};

export type ITxInfo = {
  sender: string;
  change?: Recipient;
  recipients: Recipient[];
  total: bigint;
  txFee: bigint;
  feeRate: bigint;
};

export type CreateTransactionOptions = {
  utxos: Utxo[];
  fee: number;
  //
  // BIP125 opt-in RBF flag,
  //
  replaceable?: boolean;
};

export class BtcWallet {
  protected readonly _deriver: BtcAccountDeriver;

  protected readonly _network: Network;

  protected readonly _chainApi: BtcOnChainService;

  constructor(deriver: BtcAccountDeriver, network: Network) {
    this._deriver = deriver;
    this._network = network;
    this._chainApi = Factory.createOnChainServiceProvider(
      getCaip2ChainId(network),
    );
  }

  /**
   * Unlocks an account by index and script type.
   *
   * @param index - The index to derive from the node.
   * @param type - The script type of the unlocked account, e.g. `bip122:p2pkh`.
   * @returns A promise that resolves to a `BtcAccount` object.
   */
  async unlock(index: number, type?: string): Promise<BtcAccount> {
    try {
      const AccountCtor = this.getAccountCtor(type ?? ScriptType.P2wpkh);
      const childNodeHdPath = [`m`, `0'`, `0`, `${index}`];
      const rootNode = await this._deriver.getRoot(AccountCtor.path);
      const childNode = await this._deriver.getChild(rootNode, childNodeHdPath);

      return new AccountCtor(
        bufferToString(rootNode.fingerprint, 'hex'),
        index,
        childNodeHdPath.join('/'),
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

  /**
   * Creates a transaction using the given account, transaction intent, and options.
   *
   * @param account - The `IAccount` object to create the transaction.
   * @param recipients - The transaction recipients.
   * @param options - The options to use when creating the transaction.
   * @returns A promise that resolves to an object containing the transaction hash and transaction info.
   * @throws {TxValidationError} Throws a TxValidationError if there are insufficient funds to complete the transaction.
   */
  async createTransaction(
    account: BtcAccount,
    recipients: Recipient[],
    options: CreateTransactionOptions,
  ): Promise<Transaction> {
    const {
      scriptType,
      script: scriptOutput,
      address,
      hdPath,
      pubkey,
      mfp,
      signer,
    } = account;

    const inputs = this.createTxInput(options.utxos, scriptOutput);
    const outputs = this.createTxOutput(recipients, scriptType);
    // TODO: We could have the minimum fee rate coming from the parameter and use it here:
    const feeRate = this.getFeeRate(options.fee);

    const selectionResult = this.selectCoins(
      inputs,
      outputs,
      new TxOutput(0, address, scriptOutput),
      feeRate,
    );

    if (
      selectionResult.inputs.length === 0 ||
      selectionResult.outputs.length === 0
    ) {
      throw new InsufficientFundsError();
    }

    const psbtService = new PsbtService(this._network);
    psbtService.addInputs(
      selectionResult.inputs,
      // Is now enabled by default (requirement for the Keyring API v9.0.0)
      options.replaceable ?? true,
      hdPath,
      hexToBuffer(pubkey, false),
      hexToBuffer(mfp, false),
    );

    const txInfo = new TxInfo(address, feeRate);

    for (const output of selectionResult.outputs) {
      psbtService.addOutput(output);
      txInfo.addRecipient(output);
    }

    if (selectionResult.change) {
      if (isDust(selectionResult.change.value, scriptType)) {
        logger.warn(
          '[BtcWallet.createTransaction] Change is too small, adding to fees',
        );
      } else {
        psbtService.addOutput(selectionResult.change);
        txInfo.addChange(selectionResult.change);
      }
    }

    // Sign dummy transaction to extract the fee which is more accurate
    const signedService = await psbtService.signDummy(signer);
    txInfo.txFee = signedService.getFee();

    return {
      tx: psbtService.toBase64(),
      txInfo,
    };
  }

  /**
   * Creates a transaction using the given account, transaction intent, and options.
   *
   * @param account - The `IAccount` object to create the transaction.
   * @param recipients - The transaction recipients.
   * @param options - The options to use when creating the transaction.
   * @returns A promise that resolves to an object containing the transaction hash and transaction info.
   */
  async estimateFee(
    account: BtcAccount,
    recipients: Recipient[],
    options: CreateTransactionOptions,
  ): Promise<SelectionResult> {
    const { scriptType, script: scriptOutput } = account;

    const inputs = this.createTxInput(options.utxos, scriptOutput);
    const outputs = this.createTxOutput(recipients, scriptType);
    // TODO: We could have the minimum fee rate coming from the parameter and use it here:
    const feeRate = this.getFeeRate(options.fee);

    return this.selectCoins(
      inputs,
      outputs,
      new TxOutput(0, account.address, scriptOutput),
      feeRate,
    );
  }

  /**
   * Signs a transaction by the given encoded transaction string.
   *
   * @param signer - The `AccountSigner` object to sign the transaction.
   * @param tx - The encoded transaction string to convert back to a transaction.
   * @returns A promise that resolves to a string of the signed transaction.
   */
  async signTransaction(signer: AccountSigner, tx: string): Promise<string> {
    const psbtService = PsbtService.fromBase64(this._network, tx);
    await psbtService.signNVerify(signer);
    return psbtService.finalize();
  }

  protected getHdSigner(rootNode: BIP32Interface): AccountSigner {
    return new AccountSigner(rootNode, rootNode.fingerprint);
  }

  protected getAccountCtor(type: string): IStaticBtcAccount {
    let scriptType = type;
    if (type.includes('bip122:')) {
      scriptType = type.split(':')[1];
    }

    switch (scriptType.toLowerCase()) {
      case ScriptType.P2wpkh.toLowerCase():
        return this.getP2WPKHAccountCtorByNetwork();
      default:
        throw new WalletError('Invalid script type');
    }
  }

  protected createTxInput(utxos: Utxo[], scriptOutput: Buffer): TxInput[] {
    return utxos.map((utxo) => new TxInput(utxo, scriptOutput));
  }

  protected createTxOutput(
    recipients: Recipient[],
    scriptType: ScriptType,
  ): TxOutput[] {
    return recipients.map((recipient) => {
      if (isDust(recipient.value, scriptType)) {
        throw new TransactionDustError();
      }
      const destinationScriptOutput = getScriptForDestination(
        recipient.address,
        this._network,
      );
      return new TxOutput(
        recipient.value,
        recipient.address,
        destinationScriptOutput,
      );
    });
  }

  protected selectCoins(
    inputs: TxInput[],
    outputs: TxOutput[],
    change: TxOutput,
    feeRate: number,
  ): SelectionResult {
    const coinSelectService = new CoinSelectService(feeRate);
    return coinSelectService.selectCoins(inputs, outputs, change);
  }

  protected getP2WPKHAccountCtorByNetwork(): IStaticBtcAccount {
    switch (this._network) {
      case networks.bitcoin:
        return P2WPKHAccount;
      case networks.testnet:
        return P2WPKHTestnetAccount;
      default:
        throw new WalletError('Invalid network');
    }
  }

  protected getFeeRate(feeRate: number) {
    // READ THIS CAREFULLY:
    // Do not ever accept a 0 fee rate, we need to ensure it is at least 1
    return Math.max(feeRate, 1);
  }
}
