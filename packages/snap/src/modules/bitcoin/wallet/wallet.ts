import type { Json } from '@metamask/snaps-sdk';
import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';
import { type Buffer } from 'buffer';

import { compactError } from '../../../utils';
import type { TransactionIntent } from '../../chain/types';
import type { IAccountSigner } from '../../keyring';
import { type IAccount, type IWallet } from '../../keyring';
import { ScriptType } from '../constants';
import { P2WPKHAccount, P2SHP2WPKHAccount } from './account';
import { WalletError } from './exceptions';
import { AccountSigner } from './signer';
import type { IStaticBtcAccount, IBtcAccountDeriver } from './types';

export class BtcWallet implements IWallet {
  protected readonly deriver: IBtcAccountDeriver;

  protected readonly network: Network;

  constructor(deriver: IBtcAccountDeriver, network: Network) {
    this.deriver = deriver;
    this.network = network;
  }

  protected getAccountCtor(type: string): IStaticBtcAccount {
    switch (type.toLowerCase()) {
      case ScriptType.P2wpkh.toLowerCase():
        return P2WPKHAccount;
      case ScriptType.P2shP2wkh.toLowerCase():
        return P2SHP2WPKHAccount;
      default:
        throw new WalletError('Invalid script type');
    }
  }

  async unlock(index: number, type: string): Promise<IAccount> {
    try {
      const AccountCtor = this.getAccountCtor(type);
      const rootNode = await this.deriver.getRoot(AccountCtor.path);
      const childNode = await this.deriver.getChild(rootNode, index);
      const hdPath = [`m`, `0'`, `0`, `${index}`].join('/');

      return new AccountCtor(
        this.getFingerPrintInHex(rootNode),
        index,
        hdPath,
        this.getPublicKeyInHex(childNode),
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    acount: IAccount,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    txn: TransactionIntent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: {
      metadata: Record<string, Json>;
      fee: number;
    },
  ): Promise<{
    txn: Buffer;
    txnJson: Record<string, Json>;
  }> {
    // create PSBT
    // add PSBT input
    // add PSBT output
    // out PSBT base64 buffer
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signTransaction(signer: IAccountSigner, txn: Buffer): Promise<string> {
    // convert txn to PSBT
    // validate PSBT
    // finalize PSBT
    // sign PSBT
    // verify sign
    // out txn hex
    throw new Error('Method not implemented.');
  }

  protected getFingerPrintInHex(rootNode: BIP32Interface) {
    try {
      return rootNode.fingerprint.toString('hex');
    } catch (error) {
      throw new Error('Unable to get fingerprint in hex');
    }
  }

  protected getPublicKeyInHex(rootNode: BIP32Interface) {
    try {
      return rootNode.publicKey.toString('hex');
    } catch (error) {
      throw new Error('Unable to get public key in hex');
    }
  }

  protected getHdSigner(rootNode: BIP32Interface) {
    return new AccountSigner(rootNode, rootNode.fingerprint);
  }
}
