import type { Network, Psbt, TxBuilder } from '@metamask/bitcoindevkit';
import {
  OutPoint,
  Address,
  Amount,
  FeeRate,
  Recipient,
  BdkError,
} from '@metamask/bitcoindevkit';

import type { CreateTxError, TransactionBuilder } from '../entities';

export class BdkTxBuilderAdapter implements TransactionBuilder {
  #builder: TxBuilder;

  readonly #network: Network;

  constructor(builder: TxBuilder, network: Network) {
    this.#builder = builder;
    this.#network = network;
  }

  addRecipient(amount: string, recipientAddress: string): TransactionBuilder {
    const recipient = new Recipient(
      Address.from_string(recipientAddress, this.#network),
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
    this.#builder = this.#builder.drain_to(to);
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

  finish(): Psbt {
    try {
      return this.#builder.finish();
    } catch (error) {
      let txError: CreateTxError;
      if (error instanceof BdkError) {
        const { message, code, data } = error;
        txError = {
          message,
          code,
          data,
        };
      } else {
        txError = {
          message: error instanceof Error ? error.message : String(error),
          code: 'unknown',
          data: null,
        };
      }

      throw txError;
    }
  }
}
