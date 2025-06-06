import type { Psbt } from '@metamask/bitcoindevkit';

/**
 * A Bitcoin transaction builder.
 */
export type TransactionBuilder = {
  /**
   * Add a new recipient the PSBT.
   *
   * @param amount - The amount in satoshis
   * @param recipientAddress - The recipient address
   */
  addRecipient(amount: string, recipientAddress: string): TransactionBuilder;

  /**
   * Set the PSBT fee rate.
   *
   * @param feeRate - The fee rate in sat/vB
   */
  feeRate(feeRate: number): TransactionBuilder;

  /**
   * Spend all the available inputs. This respects filters like `unspendable` and the change policy.
   */
  drainWallet(): TransactionBuilder;

  /**
   * Sets the address to *drain* excess coins to.
   *
   * Usually, when there are excess coins they are sent to a change address generated by the
   * wallet. This option replaces the usual change address with an arbitrary `script_pubkey` of
   * your choosing.
   *
   * @param address - The recipient address
   */
  drainTo(address: string): TransactionBuilder;

  /**
   * Set the list of unspendable UTXOs. These outpoints won't be selected by the coin selection algorithm.
   *
   * @param unspendable - The list of unspendable UTXO outpoints.
   */
  unspendable(unspendable: string[]): TransactionBuilder;

  /**
   * Creates the PSBT.
   *
   * @returns the PSBT
   */
  finish(): Psbt;
};
