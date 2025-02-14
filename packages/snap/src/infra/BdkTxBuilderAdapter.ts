import type { Network, Psbt, TxBuilder } from 'bitcoindevkit';
import {
  Address,
  Amount,
  FeeRate,
  Outpoint,
  Recipient,
  Txid,
} from 'bitcoindevkit';

import type { TransactionBuilder } from '../entities';

export class BdkTxBuilderAdapter implements TransactionBuilder {
  readonly #builder: TxBuilder;

  readonly #network: Network;

  constructor(builder: TxBuilder, network: Network) {
    this.#builder = builder;
    this.#network = network;
  }

  addRecipient(amount: string, recipientAddress: string): TransactionBuilder {
    const recipient = new Recipient(
      Address.new(recipientAddress, this.#network),
      Amount.from_sat(BigInt(amount)),
    );
    this.#builder.add_recipient(recipient);
    return this;
  }

  feeRate(feeRate: number): BdkTxBuilderAdapter {
    this.#builder.fee_rate(new FeeRate(BigInt(feeRate)));
    return this;
  }

  drainWallet(): BdkTxBuilderAdapter {
    this.#builder.drain_wallet();
    return this;
  }

  drainTo(address: string): BdkTxBuilderAdapter {
    const to = Address.new(address, this.#network);
    this.#builder.drain_to(to);
    return this;
  }

  unspendable(unspendable: string[]): BdkTxBuilderAdapter {
    const outpoints = unspendable.map((outpoint) => {
      const [txid, vout] = outpoint.split(':');
      return new Outpoint(Txid.new(txid), Number(vout));
    });

    this.#builder.unspendable(outpoints);
    return this;
  }

  finish(): Psbt {
    return this.#builder.finish();
  }
}
