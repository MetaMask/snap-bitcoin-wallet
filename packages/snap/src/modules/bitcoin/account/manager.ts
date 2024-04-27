import type { Json } from '@metamask/snaps-sdk';
import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';

import { compactError } from '../../../utils';
import type { TransactionIntent } from '../../chain/types';
import { type IAccount, type IAccountMgr } from '../../keyring';
import { AccountMgrError } from './exceptions';
import { AccountSigner } from './signer';
import type { IStaticBtcAccount, IBtcAccountDeriver } from './types';

export class BtcAccountMgr implements IAccountMgr {
  protected readonly deriver: IBtcAccountDeriver;

  protected readonly accountCtor: IStaticBtcAccount;

  protected readonly network: Network;

  constructor(
    deriver: IBtcAccountDeriver,
    accountCtor: IStaticBtcAccount,
    network: Network,
  ) {
    this.deriver = deriver;
    this.accountCtor = accountCtor;
    this.network = network;
  }

  async unlock(index: number): Promise<IAccount> {
    try {
      const AccountCtor = this.accountCtor;

      const rootNode = await this.deriver.getRoot(AccountCtor.path);
      const childNode = await this.deriver.getChild(rootNode, index);
      const hdPath = [`m`, `0'`, `0`, `${index}`].join('/');

      return new AccountCtor(
        rootNode.fingerprint.toString('hex'),
        index,
        hdPath,
        childNode.publicKey.toString('hex'),
        this.network,
        AccountCtor.scriptType,
        `bip122:${AccountCtor.scriptType.toLowerCase()}`,
        this.getHdSigner(rootNode),
      );
    } catch (error) {
      throw compactError(error, AccountMgrError);
    }
  }

  /* eslint-disable */
  async createTransaction(
    acount: IAccount,
    txn: TransactionIntent,
    options: {
      metadata: Record<string, Json>;
      fee: number;
    },
  ): Promise<{
    txn: Buffer;
    txnJson: Record<string, Json>;
  }> {
    throw new Error('Method not implemented.');
  }
  /* eslint-disable */

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
