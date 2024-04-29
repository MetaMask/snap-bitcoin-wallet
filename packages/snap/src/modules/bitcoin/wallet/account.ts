import type { Network, Payment } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import type { StaticImplements } from '../../../types/static';
import { hexToBuffer } from '../../../utils';
import { ScriptType } from '../constants';
import { getBtcPaymentInst } from '../utils/payment';
import type { IBtcAccount, IStaticBtcAccount, IAccountSigner } from './types';

export class BtcAccount implements IBtcAccount {
  #address: string;

  #payment: Payment;

  readonly mfp: string;

  readonly index: number;

  readonly hdPath: string;

  readonly pubkey: string;

  readonly network: Network;

  readonly scriptType: ScriptType;

  readonly type: string;

  readonly signer: IAccountSigner;

  constructor(
    mfp: string,
    index: number,
    hdPath: string,
    pubkey: string,
    network: Network,
    scriptType: ScriptType,
    type: string,
    signer: IAccountSigner,
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

  get address() {
    if (!this.#address) {
      if (!this.payment.address) {
        throw new Error('Payment address is missing');
      }
      this.#address = this.payment.address;
    }
    return this.#address;
  }

  get payment() {
    if (!this.#payment) {
      this.#payment = getBtcPaymentInst(
        this.scriptType,
        this.pubkeyToBuf(this.pubkey),
        this.network,
      );
    }
    return this.#payment;
  }

  protected pubkeyToBuf(pubkey: string): Buffer {
    try {
      return hexToBuffer(pubkey, false);
    } catch (error) {
      throw new Error('Public key is invalid');
    }
  }

  async sign(message: Buffer): Promise<Buffer> {
    return await this.signer.sign(message);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signTransaction<Txn>(tx: Txn): Promise<string> {
    throw new Error('Method not implemented.');
  }
}

export class P2WPKHAccount
  extends BtcAccount
  implements StaticImplements<IStaticBtcAccount, typeof P2WPKHAccount>
{
  static readonly path = ['m', "84'", "0'"];

  static readonly scriptType = ScriptType.P2wpkh;
}

export class P2SHP2WPKHAccount
  extends BtcAccount
  implements StaticImplements<IStaticBtcAccount, typeof P2SHP2WPKHAccount>
{
  static readonly path = ['m', "49'", "0'"];

  static readonly scriptType = ScriptType.P2shP2wkh;
}
