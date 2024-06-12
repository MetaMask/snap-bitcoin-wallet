import type { TxOutput } from './transaction-output';
import type { ITxInfo, Recipient } from './wallet';

export class BtcTxInfo implements ITxInfo {
  readonly sender: string;

  protected _change?: Recipient;

  protected _recipients: Recipient[];

  protected _outputTotal: bigint;

  protected _txFee: bigint;

  protected _feeRate: bigint;

  constructor(sender: string, feeRate: number) {
    this.feeRate = feeRate;
    this.txFee = 0;
    this.sender = sender;

    this._recipients = [];
    this._outputTotal = BigInt(0);
  }

  addRecipients(outputs: TxOutput[]): void {
    for (const output of outputs) {
      this.addRecipient(output);
    }
  }

  addRecipient(output: TxOutput): void {
    this._outputTotal += output.bigIntValue;

    this._recipients.push({
      address: output.address,
      value: output.bigIntValue,
    });
  }

  addChange(change: TxOutput): void {
    this._change = {
      address: change.address,
      value: change.bigIntValue,
    };
  }

  set txFee(fee: bigint | number) {
    if (typeof fee === 'number') {
      this._txFee = BigInt(fee);
    } else {
      this._txFee = fee;
    }
  }

  get txFee(): bigint {
    return this._txFee;
  }

  set feeRate(fee: bigint | number) {
    if (typeof fee === 'number') {
      this._feeRate = BigInt(fee);
    } else {
      this._feeRate = fee;
    }
  }

  get feeRate(): bigint {
    return this._feeRate;
  }

  get total(): bigint {
    return (
      this._outputTotal +
      (this.change ? BigInt(this.change.value) : BigInt(0)) +
      this.txFee
    );
  }

  get recipients(): Recipient[] {
    return this._recipients;
  }

  get change(): Recipient | undefined {
    return this._change;
  }
}
