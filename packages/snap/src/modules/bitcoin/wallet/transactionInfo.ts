import type { Json } from '@metamask/snaps-sdk';

import type { ITransactionInfo } from '../../../wallet';
import type { BtcAddress } from './address';
import { BtcAmount } from './amount';

export class BtcTransactionInfo implements ITransactionInfo {
  recipients: Map<BtcAddress, BtcAmount>;

  changes: Map<BtcAddress, BtcAmount>;

  sender?: BtcAddress;

  feeRate: BtcAmount;

  txnFee: BtcAmount;

  _total: BtcAmount;

  constructor() {
    this.recipients = new Map();
    this.changes = new Map();
    this.feeRate = new BtcAmount(1);
    this.txnFee = new BtcAmount(0);
    this._total = new BtcAmount(0);
  }

  get total(): BtcAmount {
    this._total.value = this.txnFee.value;
    this.recipients.forEach((value) => {
      this._total.value += value.value;
    });
    this.changes.forEach((value) => {
      this._total.value += value.value;
    });
    return this._total;
  }

  recipientsToJson(recipients: Map<BtcAddress, BtcAmount>) {
    const recipientsArr: Json[] = [];

    recipients.forEach((value, address) => {
      recipientsArr.push({
        ...address.toJson(),
        ...value.toJson(),
      });
    });
    return recipientsArr;
  }

  toJson<InfoJson extends Record<string, Json>>(): InfoJson {
    return {
      feeRate: this.feeRate.toString(true),
      txnFee: this.txnFee.toString(true),
      sender: this.sender?.toString(),
      recipients: this.recipientsToJson(this.recipients),
      changes: this.recipientsToJson(this.changes),
      total: this.total.toString(true),
    } as unknown as InfoJson;
  }
}
