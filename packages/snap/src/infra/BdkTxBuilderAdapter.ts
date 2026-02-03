import type {
  Network,
  Psbt,
  ScriptBuf,
  TxBuilder,
} from '@bitcoindevkit/bdk-wallet-web';
import {
  TxOrdering,
  OutPoint,
  Address,
  Amount,
  FeeRate,
  Recipient,
} from '@bitcoindevkit/bdk-wallet-web';

import {
  type CodifiedError,
  ValidationError,
  type TransactionBuilder,
} from '../entities';

export class BdkTxBuilderAdapter implements TransactionBuilder {
  #builder: TxBuilder;

  readonly #network: Network;

  constructor(builder: TxBuilder, network: Network) {
    this.#builder = builder;
    this.#network = network;
  }

  addRecipient(amount: string, recipientAddress: string): TransactionBuilder {
    let recipient: Recipient;
    try {
      recipient = new Recipient(
        Address.from_string(recipientAddress, this.#network).script_pubkey,
        Amount.from_sat(BigInt(amount)),
      );
      return this.addRecipientByScript(
        recipient.amount,
        recipient.script_pubkey,
      );
    } catch (error) {
      throw new ValidationError(
        'Invalid recipient',
        {
          amount,
          address: recipientAddress,
        },
        // Because of an issue with BDK, the error returned is not an Error object
        // so we need to wrap it in an Error object
        new Error((error as CodifiedError).message),
      );
    }
  }

  addRecipientByScript(
    amount: Amount,
    recipientScriptPubkey: ScriptBuf,
  ): TransactionBuilder {
    const recipient = new Recipient(recipientScriptPubkey, amount);
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
    return this.drainToByScript(to.script_pubkey);
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

  untouchedOrdering(): BdkTxBuilderAdapter {
    this.#builder = this.#builder.ordering(TxOrdering.Untouched);
    return this;
  }

  finish(): Psbt {
    return this.#builder.finish();
  }
}
