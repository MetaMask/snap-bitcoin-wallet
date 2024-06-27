import type { Network, Payment } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import { hexToBuffer } from '../../utils';
import type { StaticImplements } from '../../utils/static';
import { ScriptType } from './constants';
import type { AccountSigner } from './signer';
import { getBtcPaymentInst } from './utils';

export type IStaticBtcAccount = {
  path: string[];
  scriptType: ScriptType;
  new (
    mfp: string,
    index: number,
    hdPath: string,
    pubkey: string,
    network: Network,
    scriptType: ScriptType,
    type: string,
    signer: AccountSigner,
  ): BtcAccount;
};

export abstract class BtcAccount {
  #address: string;

  #payment: Payment;

  readonly network: Network;

  readonly scriptType: ScriptType;

  /**
   * The master fingerprint of the derived node, as a string.
   */
  readonly mfp: string;

  /**
   * The index of the derived node, as a number.
   */
  readonly index: number;

  /**
   * The HD path of the account, as a string.
   */
  readonly hdPath: string;

  /**
   * The public key of the account, as a string.
   */
  readonly pubkey: string;

  /**
   * The type of the account, e.g. `bip122:p2pwh`, as a string.
   */
  readonly type: string;

  /**
   * The `IAccountSigner` object derived from the root node.
   */
  readonly signer: AccountSigner;

  constructor(
    mfp: string,
    index: number,
    hdPath: string,
    pubkey: string,
    network: Network,
    scriptType: ScriptType,
    type: string,
    signer: AccountSigner,
  ) {
    this.mfp = mfp;
    this.index = index;
    this.hdPath = hdPath;
    this.pubkey = pubkey;
    this.network = network;
    this.scriptType = scriptType;
    this.signer = signer;
    this.type = type;
  }

  /**
   * A getter function to return the correcsponing account type's output script.
   *
   * @returns The correcsponing account type's output script.
   */
  get script(): Buffer {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.payment.output!;
  }

  /**
   * A getter function to return the correcsponing account type's address.
   *
   * @returns The correcsponing account type's address.
   */
  get address(): string {
    if (!this.#address) {
      if (!this.payment.address) {
        throw new Error('Payment address is missing');
      }
      this.#address = this.payment.address;
    }
    return this.#address;
  }

  /**
   * A getter function to return the correcsponing account type's payment instance.
   *
   * @returns The correcsponing account type's payment instance.
   */
  get payment(): Payment {
    if (!this.#payment) {
      this.#payment = getBtcPaymentInst(
        this.scriptType,
        hexToBuffer(this.pubkey),
        this.network,
      );
    }
    return this.#payment;
  }
}

export class P2WPKHAccount
  extends BtcAccount
  implements StaticImplements<IStaticBtcAccount, typeof P2WPKHAccount>
{
  static readonly path = ['m', "84'", "0'"];

  static readonly scriptType = ScriptType.P2wpkh;
}
