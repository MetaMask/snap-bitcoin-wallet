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

  #recipients: TxOutput[];

  #feeRate: BtcAmount;

  #outputTotal: BtcAmount;

  #serializedRecipients: Json[];

  #network: Network;

  constructor(sender: BtcAddress, feeRate: number, network: Network) {
    this.#recipients = [];
    this.#serializedRecipients = [];
    this.#outputTotal = new BtcAmount(0);
    this.#feeRate = new BtcAmount(feeRate);
    this.txFee = new BtcAmount(0);
    this.#network = network;
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
              getCaip2ChainId(this.#network),
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
    this.#outputTotal.value += output.value;

    this.#recipients.push(output);

    this.#serializedRecipients.push({
      address: output.destination.toString(true),
      value: output.amount.toString(true),
      explorerUrl: getExplorerUrl(
        output.destination.value,
        getCaip2ChainId(this.#network),
      ),
    });
  }

  get total(): BtcAmount {
    return new BtcAmount(
      this.#outputTotal.value +
        (this.change ? this.change.value : 0) +
        this.txFee.value,
    );
  }

  get feeRate(): BtcAmount {
    return this.#feeRate;
  }

  get recipients(): TxOutput[] {
    return this.#recipients;
  }

  get fee(): number {
    return this.txFee.value;
  }

  set fee(val: number) {
    this.txFee.value = val;
  }

  toJson<InfoJson extends Record<string, Json>>(): InfoJson {
    return {
      feeRate: this.#feeRate.toString(true),
      txFee: this.txFee.toString(true),
      sender: this.sender.toString(),
      recipients: this.#serializedRecipients,
      changes: this.changeToJson(),
      total: this.total.toString(true),
    } as unknown as InfoJson;
  }
}
