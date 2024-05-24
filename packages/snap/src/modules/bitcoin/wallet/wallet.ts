import type { Json } from '@metamask/snaps-sdk';
import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';

import type { TransactionIntent } from '../../../chain';
import { bufferToString, compactError, hexToBuffer } from '../../../utils';
import type { IAccountSigner, IWallet } from '../../../wallet';
import { ScriptType } from '../constants';
import { isDust } from '../utils/unit';
import { P2WPKHAccount, P2SHP2WPKHAccount } from './account';
import { WalletError } from './exceptions';
import { PsbtService } from './psbt';
import { AccountSigner } from './signer';
import type {
  IStaticBtcAccount,
  IBtcAccountDeriver,
  IBtcAccount,
  SpendTo,
  Utxo,
} from './types';
import { UtxoService } from './utxo';

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

  async createTransaction<TxnJson extends Record<string, Json>>(
    account: IBtcAccount,
    txn: TransactionIntent,
    options: {
      utxos: Utxo[];
      fee: number;
    },
  ): Promise<{
    txn: string;
    txnJson: TxnJson;
  }> {
    const utxosService = new UtxoService();
    const spendTos = Object.entries(txn.amounts).map(([address, value]) => {
      if (isDust(value, account.scriptType)) {
        throw new WalletError('Transaction amount too small');
      }
      return {
        address,
        value,
      };
    });

    const { inputs, outputs, fee } = utxosService.selectCoins(
      options.utxos,
      spendTos,
      options.fee,
    );

    const psbtService = new PsbtService(this.network);

    const scriptOutput = account.payment.output;

    if (!scriptOutput) {
      throw new WalletError('Unable to get account script hash');
    }

    const changes: SpendTo[] = [];
    const recipients: SpendTo[] = [];
    const formattedOutputs: SpendTo[] = [];
    for (const output of outputs) {
      if (output.address === undefined) {
        changes.push({
          address: account.address,
          value: output.value,
        });
      } else {
        recipients.push({
          address: output.address,
          value: output.value,
        });
      }
      formattedOutputs.push({
        address: output.address ?? account.address,
        value: output.value,
      });
    }

    psbtService.addInputs(
      inputs,
      hexToBuffer(account.mfp, false),
      hexToBuffer(account.pubkey, false),
      scriptOutput,
      account.hdPath,
    );

    psbtService.addOutputs(formattedOutputs);

    return {
      txn: psbtService.toBase64(),
      txnJson: {
        feeRate: options.fee,
        estimatedFee: fee,
        sender: account.address,
        recipients,
        changes,
      } as unknown as TxnJson,
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
