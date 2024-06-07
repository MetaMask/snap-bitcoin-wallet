import type { Json } from '@metamask/snaps-sdk';
import type { Network } from 'bitcoinjs-lib';

import type { ITxInfo } from '../../wallet';
import { getCaip2ChainId, getExplorerUrl } from '../utils';
import type { BtcAddress } from './address';
import { BtcAmount } from './amount';
import type { TxOutput } from './transaction-output';

export class BtcTxInfo implements ITxInfo {
  readonly sender: BtcAddress;

  readonly txFee: BtcAmount;

  change?: TxOutput;

  protected _recipients: TxOutput[];

  protected _feeRate: BtcAmount;

  protected _outputTotal: BtcAmount;

  protected _serializedRecipients: Json[];

  protected _network: Network;

  constructor(sender: BtcAddress, feeRate: number, network: Network) {
    this._recipients = [];
    this._serializedRecipients = [];
    this._outputTotal = new BtcAmount(0);
    this._feeRate = new BtcAmount(feeRate);
    this.txFee = new BtcAmount(0);
    this._network = network;
    this.sender = sender;
  }

  protected changeToJson(): Json {
    return this.change
      ? [
          {
            address: this.change.destination.toString(true),
            value: this.change.amount.toString(true),
            explorerUrl: getExplorerUrl(
              this.change.destination.value,
              getCaip2ChainId(this._network),
            ),
          },
        ]
      : [];
  }

  addRecipients(outputs: TxOutput[]): void {
    for (const output of outputs) {
      this.addRecipient(output);
    }
  }

  addRecipient(output: TxOutput): void {
    this._outputTotal.value += output.amount.value;

    this._recipients.push(output);

    this._serializedRecipients.push({
      address: output.destination.toString(true),
      value: output.amount.toString(true),
      explorerUrl: getExplorerUrl(
        output.destination.value,
        getCaip2ChainId(this._network),
      ),
    });
  }

  get total(): BtcAmount {
    return new BtcAmount(
      this._outputTotal.value +
        (this.change ? this.change.amount.value : BigInt(0)) +
        this.txFee.value,
    );
  }

  get feeRate(): BtcAmount {
    return this._feeRate;
  }

  get recipients(): TxOutput[] {
    return this._recipients;
  }

  get fee(): number {
    return Number(this.txFee.value);
  }

  set fee(val: number) {
    this.txFee.value = BigInt(val);
  }

  toJson<InfoJson extends Record<string, Json>>(): InfoJson {
    return {
      feeRate: this._feeRate.toString(true),
      txFee: this.txFee.toString(true),
      sender: this.sender.toString(),
      recipients: this._serializedRecipients,
      changes: this.changeToJson(),
      total: this.total.toString(true),
    } as unknown as InfoJson;
  }
}
