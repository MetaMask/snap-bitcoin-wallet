import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';

import type { TransactionIntent } from '../../chain';
import { logger } from '../../libs/logger/logger';
import { bufferToString, compactError, hexToBuffer } from '../../utils';
import type { IAccountSigner, ITransactionInfo, IWallet } from '../../wallet';
import { ScriptType } from '../constants';
import { isDust } from '../utils';
import { P2WPKHAccount, P2SHP2WPKHAccount } from './account';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';
import { CoinSelectService } from './coin-select';
import { WalletError, TransactionValidationError } from './exceptions';
import { PsbtService } from './psbt';
import { AccountSigner } from './signer';
import { BtcTransactionInfo } from './transactionInfo';
import type {
  IStaticBtcAccount,
  IBtcAccountDeriver,
  IBtcAccount,
  SpendTo,
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
    txn: TransactionIntent,
    options: CreateTransactionOptions,
  ): Promise<{
    txn: string;
    txnInfo: ITransactionInfo;
  }> {
    const scriptOutput = account.payment.output;
    const { scriptType } = account;

    if (!scriptOutput) {
      throw new WalletError('Fail to get account script hash');
    }

    // as fee rate can be 0, we need to ensure it is at least 1
    // TODO the min fee rate can be setting by parameter
    const feeRate = Math.max(1, options.fee);

    const coinSelectService = new CoinSelectService(feeRate);
    const spendTos = Object.entries(txn.amounts).map(([address, value]) => {
      return {
        address,
        value,
      };
    });

    logger.info(
      `[BtcWallet.createTransaction] Incoming inputs: ${JSON.stringify(
        options.utxos,
        null,
        2,
      )}, Incoming outputs: ${JSON.stringify(spendTos, null, 2)}`,
    );

    const { inputs, outputs, fee } = coinSelectService.selectCoins(
      options.utxos,
      spendTos,
      scriptOutput,
    );

    logger.info(
      `[BtcWallet.createTransaction] Selected inputs: ${JSON.stringify(
        inputs,
        null,
        2,
      )}, Selected outputs: ${JSON.stringify(outputs, null, 2)}`,
    );

    const info = new BtcTransactionInfo();
    info.feeRate.value = feeRate;
    info.txnFee.value = fee;
    info.sender = new BtcAddress(account.address, this.network);

    const psbtOutputs: SpendTo[] = [];

    for (const output of outputs) {
      if (output.address === undefined) {
        // discard change output if it is dust and add to fees
        if (isDust(output.value, scriptType)) {
          logger.info(
            '[BtcWallet.createTransaction] Change is too small, adding to fees',
          );
          info.txnFee.value += output.value;
          continue;
        }
        info.changes.set(
          new BtcAddress(account.address, this.network),
          new BtcAmount(output.value),
        );
      } else {
        // dust outputs is forbidden
        if (isDust(output.value, scriptType)) {
          throw new TransactionValidationError('Transaction amount too small');
        }
        info.recipients.set(
          new BtcAddress(output.address, this.network),
          new BtcAmount(output.value),
        );
      }

      psbtOutputs.push({
        address: output.address ?? account.address,
        value: output.value,
      });
    }

    const psbtService = new PsbtService(this.network);

    psbtService.addInputs(
      inputs,
      hexToBuffer(account.mfp, false),
      hexToBuffer(account.pubkey, false),
      scriptOutput,
      account.hdPath,
      options.replaceable,
    );

    psbtService.addOutputs(psbtOutputs);

    return {
      txn: psbtService.toBase64(),
      txnInfo: info,
    };
  }

  async signTransaction(signer: IAccountSigner, txn: string): Promise<string> {
    const psbtService = PsbtService.fromBase64(this.network, txn);
    await psbtService.signNVerify(signer);
    return psbtService.finalize();
  }

  protected getHdSigner(rootNode: BIP32Interface) {
    return new AccountSigner(rootNode, rootNode.fingerprint);
  }
}
