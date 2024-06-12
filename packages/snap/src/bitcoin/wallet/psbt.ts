import ecc from '@bitcoinerlab/secp256k1';
import type { HDSignerAsync, Network } from 'bitcoinjs-lib';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';
import ECPairFactory from 'ecpair';

import { compactError, logger } from '../../utils';
import { MaxStandardTxWeight } from './constants';
import { PsbtServiceError } from './exceptions';
import type { TxInput } from './transaction-input';
import type { TxOutput } from './transaction-output';

const ECPair = ECPairFactory(ecc);

export class PsbtService {
  protected readonly _psbt: Psbt;

  protected readonly _network: Network;

  get psbt() {
    return this._psbt;
  }

  constructor(network: Network, psbt?: Psbt) {
    if (psbt === undefined) {
      this._psbt = new Psbt({ network });
    } else {
      this._psbt = psbt;
    }
    this._network = network;
  }

  /**
   * Creates a new instance of the `PsbtService` class from a base64-encoded PSBT string and a network.
   *
   * @param network - The network to use for the PSBT.
   * @param base64Psbt - The base64-encoded PSBT string.
   * @returns A new instance of the `PsbtService` class.
   */
  static fromBase64(network: Network, base64Psbt: string): PsbtService {
    const psbt = Psbt.fromBase64(base64Psbt, { network });
    const service = new PsbtService(network, psbt);
    return service;
  }

  /**
   * Adds an input to the PSBT.
   *
   * @param input - The transaction input to add.
   * @param replaceable - Whether or not the transaction is replaceable.
   * @param changeAddressHdPath - The HD path of the change address.
   * @param changeAddressPubkey - The public key of the change address.
   * @param changeAddressMfp - The master fingerprint of the change address.
   * @throws {PsbtServiceError} If there was an error adding the input to the PSBT.
   */
  addInput(
    input: TxInput,
    replaceable: boolean,
    changeAddressHdPath: string,
    changeAddressPubkey: Buffer,
    changeAddressMfp: Buffer,
  ) {
    try {
      this._psbt.addInput({
        hash: input.txHash,
        index: input.index,
        witnessUtxo: {
          script: input.script,
          value: input.value,
        },
        // This is useful because as long as you store the masterFingerprint on
        // the PSBT Creator's server, you can have the PSBT Creator do the heavy
        // lifting with derivation from your m/84'/0'/0' xpub, (deriving only 0/0 )
        // and your signer just needs to pass in an HDSigner interface (ie. bip32 library)
        bip32Derivation: [
          {
            masterFingerprint: changeAddressMfp,
            path: changeAddressHdPath,
            pubkey: changeAddressPubkey,
          },
        ],

        // reference : https://en.bitcoin.it/wiki/BIP_0125
        // A transaction is considered to have opted in to allowing replacement of itself if any of its inputs have an nSequence number less than (0xffffffff - 1).
        // we use max sequence number - 2 to void conflicting with other possible uses of nSequence
        sequence: replaceable
          ? Transaction.DEFAULT_SEQUENCE - 2
          : Transaction.DEFAULT_SEQUENCE,
      });
    } catch (error) {
      logger.error('Failed to add input', error);
      throw new PsbtServiceError('Failed to add input in PSBT');
    }
  }

  /**
   * Adds multiple inputs to the PSBT.
   *
   * @param inputs - An array of transaction inputs to add.
   * @param replaceable - Whether or not the transactions are replaceable.
   * @param changeAddressHdPath - The HD path of the change address.
   * @param changeAddressPubkey - The public key of the change address.
   * @param changeAddressMfp - The master fingerprint of the change address.
   */
  addInputs(
    inputs: TxInput[],
    replaceable: boolean,
    changeAddressHdPath: string,
    changeAddressPubkey: Buffer,
    changeAddressMfp: Buffer,
  ) {
    for (const input of inputs) {
      this.addInput(
        input,
        replaceable,
        changeAddressHdPath,
        changeAddressPubkey,
        changeAddressMfp,
      );
    }
  }

  /**
   * Adds an output to the PSBT.
   *
   * @param output - The transaction output to add.
   * @throws {PsbtServiceError} If there was an error adding the output to the PSBT.
   */
  addOutput(output: TxOutput) {
    try {
      this._psbt.addOutput({
        script: output.script,
        value: output.value,
      });
    } catch (error) {
      logger.error('Failed to add output', error);
      throw new PsbtServiceError('Failed to add output in PSBT');
    }
  }

  /**
   * Adds multiple outputs to the PSBT.
   *
   * @param outputs - An array of transaction outputs to add.
   */
  addOutputs(outputs: TxOutput[]) {
    for (const output of outputs) {
      this.addOutput(output);
    }
  }

  /**
   * Gets the fee for the PSBT.
   *
   * @returns The fee for the PSBT.
   * @throws {PsbtServiceError} If there was an error getting the fee from the PSBT.
   */
  getFee(): number {
    try {
      return this._psbt.getFee();
    } catch (error) {
      logger.error('Failed to get fee', error);
      throw new PsbtServiceError('Failed to get fee from PSBT');
    }
  }

  /**
   * Signs all inputs in the PSBT with a dummy signature using an asynchronous signer.
   *
   * @param signer - The asynchronous signer to use.
   * @returns A promise that resolves with a new `PsbtService` instance with the signed inputs.
   * @throws {PsbtServiceError} If there was an error signing the inputs in the PSBT.
   */
  async signDummy(signer: HDSignerAsync): Promise<PsbtService> {
    try {
      const psbt = this._psbt.clone();
      await psbt.signAllInputsHDAsync(signer);
      psbt.finalizeAllInputs();
      return new PsbtService(this._network, psbt);
    } catch (error) {
      logger.error('Failed to sign dummy', error);
      throw new PsbtServiceError('Failed to sign dummy in PSBT');
    }
  }

  /**
   * Converts the PSBT to a base64-encoded string.
   *
   * @returns The base64-encoded string representation of the PSBT.
   * @throws {PsbtServiceError} If there was an error converting the PSBT to a base64-encoded string.
   */
  toBase64(): string {
    try {
      return this._psbt.toBase64();
    } catch (error) {
      logger.error('Failed to convert to base64', error);
      throw new PsbtServiceError('Failed to output PSBT string');
    }
  }

  /**
   * Signs all inputs in the PSBT and verifies that the signatures are valid using an asynchronous signer.
   *
   * @param signer - The asynchronous signer to use.
   * @throws {PsbtServiceError} If there was an error signing or verifying the PSBT's inputs.
   */
  async signNVerify(signer: HDSignerAsync) {
    try {
      // This function signAllInputsHDAsync is used to sign all inputs with the signer.
      // When using the method signAllInputsHDAsync, it is important to note that the signer must derive from the root node as well as the finderprint.
      // For further reference, please see the getHdSigner method in BtcWallet.
      await this._psbt.signAllInputsHDAsync(signer);

      if (
        !this._psbt.validateSignaturesOfAllInputs(
          (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
            this.validateInputs(pubkey, msghash, signature),
        )
      ) {
        throw new PsbtServiceError(
          "Invalid signature to sign the PSBT's inputs",
        );
      }
    } catch (error) {
      throw compactError(error, PsbtServiceError);
    }
  }

  /**
   * Finalizes the PSBT and returns the resulting transaction in hexadecimal format.
   *
   * @returns The transaction in hexadecimal format.
   * @throws {PsbtServiceError} If there was an error finalizing the PSBT.
   */
  finalize(): string {
    try {
      this._psbt.finalizeAllInputs();

      const txHex = this._psbt.extractTransaction().toHex();

      const weight = this._psbt.extractTransaction().weight();

      if (weight > MaxStandardTxWeight) {
        throw new PsbtServiceError('Transaction is too large');
      }

      return txHex;
    } catch (error) {
      throw compactError(error, PsbtServiceError);
    }
  }

  protected validateInputs(pubkey: Buffer, msghash: Buffer, signature: Buffer) {
    // As the signer is extract from root node, however, the pubkey is derived from the child node
    // So, using the ECPair to verify the signature is easier
    return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
  }
}
