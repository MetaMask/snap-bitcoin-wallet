import type { BIP32Interface } from 'bip32';
import { type Network } from 'bitcoinjs-lib';

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
      //eslint -disable-next-line @typescript-eslint/naming-convention
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
        this.getHdSigner(rootNode),
      );
    } catch (error) {
      throw new AccountMgrError(error);
    }
  }

  protected getHdSigner(rootNode: BIP32Interface) {
    return new AccountSigner(rootNode, rootNode.fingerprint);
  }
}
