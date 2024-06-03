import { Transaction, networks } from 'bitcoinjs-lib';

import { generateFormatedUtxos } from '../../../test/utils';
import { hexToBuffer } from '../../utils';
import { MaxStandardTxWeight, ScriptType } from '../constants';
import { BtcAccountBip32Deriver } from './deriver';
import { PsbtServiceError } from './exceptions';
import { PsbtService } from './psbt';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { BtcWallet } from './wallet';

jest.mock('../../libs/logger/logger');
jest.mock('../../libs/snap/helpers');

describe('PsbtService', () => {
  const createMockWallet = (network) => {
    const instance = new BtcWallet(
      new BtcAccountBip32Deriver(network),
      network,
    );
    return {
      instance,
    };
  };

  const preparePsbt = async (rbfOptIn = false, inputsCnt = 2) => {
    const network = networks.testnet;
    const service = new PsbtService(network);
    const wallet = createMockWallet(network);
    const sender = await wallet.instance.unlock(0, ScriptType.P2wpkh);
    const receiver1 = await wallet.instance.unlock(1, ScriptType.P2wpkh);
    const receiver2 = await wallet.instance.unlock(2, ScriptType.P2wpkh);
    const receivers = [receiver1, receiver2];
    const finalizeSpy = jest.spyOn(service.psbt, 'finalizeAllInputs');
    const inputSpy = jest.spyOn(service.psbt, 'addInput');
    const outputSpy = jest.spyOn(service.psbt, 'addOutput');
    const signSpy = jest.spyOn(service.psbt, 'signAllInputsHDAsync');
    const verifySpy = jest.spyOn(service.psbt, 'validateSignaturesOfAllInputs');
    const transactionWeightSpy = jest.spyOn(Transaction.prototype, 'weight');
    const transactionHexSpy = jest.spyOn(Transaction.prototype, 'toHex');

    const outputVal = 1000;
    const fee = 500;

    const outputs = receivers.map(
      (account) => new TxOutput(outputVal, account.address),
    );
    const utxos = generateFormatedUtxos(
      sender.address,
      inputsCnt,
      outputVal * outputs.length + fee,
      outputVal * outputs.length + fee,
    );
    const inputs = utxos.map(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (utxo) => new TxInput(utxo, sender.payment.output!),
    );

    service.addOutputs(outputs);

    service.addInputs(inputs, sender, rbfOptIn);

    return {
      service,
      sender,
      receivers,
      finalizeSpy,
      inputSpy,
      outputSpy,
      signSpy,
      verifySpy,
      inputs,
      outputs,
      transactionWeightSpy,
      transactionHexSpy,
    };
  };

  describe('constructor', () => {
    it('constructor with a new psbt object', async () => {
      const network = networks.testnet;

      const service = new PsbtService(network);

      expect(service.psbt.txInputs).toHaveLength(0);
    });

    it('constructor with an psbt base string', async () => {
      const { service } = await preparePsbt(false, 2);
      const psbtBase64 = service.toBase64();

      const newService = PsbtService.fromBase64(networks.testnet, psbtBase64);

      expect(newService.psbt.txInputs).toHaveLength(2);
      expect(newService.psbt.txOutputs).toHaveLength(2);
    });
  });

  describe('addInputs', () => {
    it('adds witnessUtxos to psbt object', async () => {
      const { service, inputSpy, inputs, sender } = await preparePsbt(
        false,
        10,
      );

      expect(service.psbt.txInputs).toHaveLength(10);

      for (let i = 0; i < service.psbt.txInputs.length; i++) {
        expect(inputSpy).toHaveBeenNthCalledWith(i + 1, {
          hash: inputs[i].txHash,
          index: inputs[i].index,
          witnessUtxo: {
            script: inputs[i].scriptBuf,
            value: inputs[i].value,
          },
          bip32Derivation: [
            {
              masterFingerprint: hexToBuffer(sender.mfp, false),
              path: sender.hdPath,
              pubkey: hexToBuffer(sender.pubkey, false),
            },
          ],
          sequence: Transaction.DEFAULT_SEQUENCE,
        });
      }
    });

    it('opt-ins RBF into the psbt input', async () => {
      const { service, inputSpy, inputs, sender } = await preparePsbt(true);

      for (let i = 0; i < service.psbt.txInputs.length; i++) {
        expect(inputSpy).toHaveBeenNthCalledWith(i + 1, {
          hash: inputs[i].txHash,
          index: inputs[i].index,
          witnessUtxo: {
            script: inputs[i].scriptBuf,
            value: inputs[i].value,
          },
          bip32Derivation: [
            {
              masterFingerprint: hexToBuffer(sender.mfp, false),
              path: sender.hdPath,
              pubkey: hexToBuffer(sender.pubkey, false),
            },
          ],
          sequence: Transaction.DEFAULT_SEQUENCE - 2,
        });
      }
    });

    it('throws `Failed to add inputs in PSBT` error if adding inputs fails', async () => {
      const { service, inputSpy, sender, inputs } = await preparePsbt();
      inputSpy.mockImplementation(() => {
        throw new Error('error');
      });

      expect(() => {
        service.addInputs(inputs, sender, false);
      }).toThrow('Failed to add inputs in PSBT');
    });
  });

  describe('addOutputs', () => {
    it('adds outputs to psbt object', async () => {
      const { service, outputs, receivers } = await preparePsbt();
      expect(service.psbt.txOutputs).toHaveLength(outputs.length);

      for (let i = 0; i < service.psbt.txOutputs.length; i++) {
        expect(service.psbt.txOutputs[i]).toHaveProperty(
          'script',
          receivers[i].payment.output,
        );
        expect(service.psbt.txOutputs[i]).toHaveProperty(
          'value',
          outputs[i].value,
        );
        expect(service.psbt.txOutputs[i]).toHaveProperty(
          'address',
          outputs[i].address,
        );
      }
    });

    it('throws `Failed to add outputs in PSBT` error if adding outputs fails', async () => {
      const { service, outputSpy, outputs } = await preparePsbt();
      outputSpy.mockImplementation(() => {
        throw new Error('error');
      });

      expect(() => service.addOutputs(outputs)).toThrow(
        'Failed to add outputs in PSBT',
      );
    });
  });

  describe('toBase64', () => {
    it('returns base64 string of psbt object', async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);

      const result = service.toBase64();

      expect(result).toBe(service.psbt.toBase64());
    });

    it('throws `Failed to output PSBT string` error if the operation failed', async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);

      jest.spyOn(service.psbt, 'toBase64').mockImplementation(() => {
        throw new Error('error');
      });

      expect(() => service.toBase64()).toThrow('Failed to output PSBT string');
    });
  });

  describe('signNVerify', () => {
    it('signs all inputs with the given signer', async () => {
      const { service, sender, signSpy, verifySpy } = await preparePsbt();

      await service.signNVerify(sender.signer);

      expect(signSpy).toHaveBeenCalledWith(sender.signer);
      expect(verifySpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it("throws `Invalid signature to sign the PSBT's inputs` error if signature is incorrect", async () => {
      const { service, sender, verifySpy } = await preparePsbt();

      verifySpy.mockReturnValue(false);

      await expect(service.signNVerify(sender.signer)).rejects.toThrow(
        "Invalid signature to sign the PSBT's inputs",
      );
    });
  });

  describe('finalize', () => {
    it('returns an transaction hex', async () => {
      const { service, finalizeSpy, sender, transactionHexSpy } =
        await preparePsbt();

      await service.signNVerify(sender.signer);

      const txHex = service.finalize();

      expect(txHex).not.toBeNull();
      expect(txHex).not.toBe('');
      expect(finalizeSpy).toHaveBeenCalled();
      expect(transactionHexSpy).toHaveBeenCalled();
    });

    it('throws `Transaction is too large` error if the transaction weight is too large', async () => {
      const { service, sender, transactionWeightSpy } = await preparePsbt();

      await service.signNVerify(sender.signer);

      transactionWeightSpy.mockReturnValue(MaxStandardTxWeight + 1000);

      expect(() => service.finalize()).toThrow(`Transaction is too large`);
    });

    it('throws PsbtServiceError error if finalize operation failed', async () => {
      const { service, sender, finalizeSpy } = await preparePsbt();

      await service.signNVerify(sender.signer);

      finalizeSpy.mockImplementation(() => {
        throw new Error('error');
      });

      expect(() => service.finalize()).toThrow(PsbtServiceError);
    });
  });
});
