import ecc from '@bitcoinerlab/secp256k1';
import type { Network } from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';
import ECPairFactory from 'ecpair';

import { compactError } from '../../../utils';
import type { Utxo } from '../../chain';
import { logger } from '../../logger/logger';
import { PsbtServiceError } from './exceptions';
import type { IAccountSigner, SpendTo } from './types';
// import { PsbtData } from "./psbt-data";

const ECPair = ECPairFactory(ecc);

export class PsbtService {
  // protected readonly psbtData: PsbtData;
  protected readonly network: Network;

  protected readonly _psbt: Psbt;

  get psbt() {
    return this._psbt;
  }

  constructor(network: Network, psbt?: Psbt) {
    if (psbt === undefined) {
      this._psbt = new Psbt({ network });
    } else {
      this._psbt = psbt;
    }
    // this.validator = new PsbtValidator(this._psbt, network);
    // this._psbtData = new PsbtData(this._psbt, network);
  }

  static fromBase64(network: Network, base64Psbt: string): PsbtService {
    const psbt = Psbt.fromBase64(base64Psbt, { network });
    const service = new PsbtService(network, psbt);

    // To make sure the psbt is created from the PSBT creator's server (The Snap)
    // service.validator.validate();

    return service;
  }

  addInputs(
    inputs: Utxo[],
    mfp: Buffer,
    changeAddressPubkey: Buffer,
    changeAddressScriptHash: Buffer,
    changeAddressHdPath: string,
  ) {
    try {
      for (const input of inputs) {
        this._psbt.addInput({
          hash: input.txnHash,
          index: input.index,
          witnessUtxo: {
            script: changeAddressScriptHash,
            value: input.value,
          },
          // This is useful because as long as you store the masterFingerprint on
          // the PSBT Creator's server, you can have the PSBT Creator do the heavy
          // lifting with derivation from your m/84'/0'/0' xpub, (deriving only 0/0 )
          // and your signer just needs to pass in an HDSigner interface (ie. bip32 library)
          bip32Derivation: [
            {
              masterFingerprint: mfp,
              path: changeAddressHdPath,
              pubkey: changeAddressPubkey,
            },
          ],
        });
      }
    } catch (error) {
      logger.error('Failed to add inputs', error);
      throw new PsbtServiceError('Failed to add inputs in PSBT');
    }
  }

  addOutputs(outputs: SpendTo[]) {
    try {
      this._psbt.addOutputs(outputs);
    } catch (error) {
      logger.error('Failed to add outputs', error);
      throw new PsbtServiceError('Failed to add outputs in PSBT');
    }
  }

  toBase64(): string {
    try {
      return this._psbt.toBase64();
    } catch (error) {
      logger.error('Failed to convert to base64', error);
      throw new PsbtServiceError('Failed to output PSBT string');
    }
  }

  async signNVerify(signer: IAccountSigner) {
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

  finalize(): string {
    try {
      this._psbt.finalizeAllInputs();

      const txHex = this._psbt.extractTransaction().toHex();

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
