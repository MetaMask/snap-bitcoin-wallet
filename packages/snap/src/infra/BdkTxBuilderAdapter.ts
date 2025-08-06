import type {
  Network,
  Psbt,
  ScriptBuf,
  TxBuilder,
  TxOrdering,
} from '@metamask/bitcoindevkit';
import {
  OutPoint,
  Address,
  Amount,
  FeeRate,
  Recipient,
} from '@metamask/bitcoindevkit';

import type { TransactionBuilder } from '../entities';

export class BdkTxBuilderAdapter implements TransactionBuilder {
  #builder: TxBuilder;

  readonly #network: Network;

  constructor(builder: TxBuilder, network: Network) {
    this.#builder = builder;
    this.#network = network;
  }

  addRecipient(amount: string, recipientAddress: string): TransactionBuilder {
    const recipient = new Recipient(
      Address.from_string(recipientAddress, this.#network).script_pubkey,
      Amount.from_sat(BigInt(amount)),
    );
    this.#builder = this.#builder.add_recipient(recipient);
    return this;
  }

  addRecipientByScript(
    amount: string,
    recipientScriptPubkey: ScriptBuf,
  ): TransactionBuilder {
    const recipient = new Recipient(
      recipientScriptPubkey,
      Amount.from_sat(BigInt(amount)),
    );
    this.#builder = this.#builder.add_recipient(recipient);
    return this;
  }

  feeRate(feeRate: number): BdkTxBuilderAdapter {
    this.#builder = this.#builder.fee_rate(
      new FeeRate(BigInt(Math.floor(feeRate))),
    );
    return this;
  }

  drainWallet(): BdkTxBuilderAdapter {
    this.#builder = this.#builder.drain_wallet();
    return this;
  }

  drainTo(address: string): BdkTxBuilderAdapter {
    const to = Address.from_string(address, this.#network);
    this.#builder = this.#builder.drain_to(to.script_pubkey);
    return this;
  }

  drainToByScript(scriptPubKey: ScriptBuf): BdkTxBuilderAdapter {
    this.#builder = this.#builder.drain_to(scriptPubKey);
    return this;
  }

  unspendable(unspendable: string[]): BdkTxBuilderAdapter {
    // Avoid calling WASM if there are no unspendable UTXOs
    if (unspendable.length) {
      const outpoints = unspendable.map((outpoint) =>
        OutPoint.from_string(outpoint),
      );
      this.#builder = this.#builder.unspendable(outpoints);
    }

    return this;
  }

  ordering(ordering: TxOrdering): BdkTxBuilderAdapter {
    this.#builder = this.#builder.ordering(ordering);
    return this;
  }

  finish(): Psbt {
    return this.#builder.finish();
  }
}
