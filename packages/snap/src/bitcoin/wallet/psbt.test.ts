import { Psbt, Transaction, networks } from 'bitcoinjs-lib';

import { generateFormatedUtxos } from '../../../test/utils';
import { hexToBuffer } from '../../utils';
import { MaxStandardTxWeight, ScriptType } from '../constants';
import { BtcAccountDeriver } from './deriver';
import { PsbtServiceError } from './exceptions';
import { PsbtService } from './psbt';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { BtcWallet } from './wallet';

jest.mock('../../utils/logger');
jest.mock('../../utils/snap');

describe('PsbtService', () => {
  const createMockWallet = (network) => {
    const instance = new BtcWallet(new BtcAccountDeriver(network), network);
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
    const finalizeSpy = jest.spyOn(Psbt.prototype, 'finalizeAllInputs');
    const inputSpy = jest.spyOn(Psbt.prototype, 'addInput');
    const outputSpy = jest.spyOn(Psbt.prototype, 'addOutput');
    const signSpy = jest.spyOn(Psbt.prototype, 'signAllInputsHDAsync');
    const verifySpy = jest.spyOn(
      Psbt.prototype,
      'validateSignaturesOfAllInputs',
    );
    const transactionWeightSpy = jest.spyOn(Transaction.prototype, 'weight');
    const transactionHexSpy = jest.spyOn(Transaction.prototype, 'toHex');

    const outputVal = 1000;
    const fee = 500;

    const outputs = receivers.map(
      (account) => new TxOutput(outputVal, account.address, account.script),
    );
    const utxos = generateFormatedUtxos(
      sender.address,
      inputsCnt,
      outputVal * outputs.length + fee,
      outputVal * outputs.length + fee,
    );
    const inputs = utxos.map((utxo) => new TxInput(utxo, sender.script));

    service.addOutputs(outputs);

    service.addInputs(
      inputs,
      rbfOptIn,
      sender.hdPath,
      hexToBuffer(sender.pubkey, false),
      hexToBuffer(sender.mfp, false),
    );

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

      expect(service.psbt).toBeInstanceOf(Psbt);
    });

    it('constructor with an psbt base string', async () => {
      const { service } = await preparePsbt(false, 2);
      const psbtBase64 = service.toBase64();

      const newService = PsbtService.fromBase64(networks.testnet, psbtBase64);

      expect(newService.psbt).toBeInstanceOf(Psbt);
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
            script: inputs[i].script,
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
            script: inputs[i].script,
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
        service.addInputs(
          inputs,
          false,
          sender.hdPath,
          hexToBuffer(sender.pubkey, false),
          hexToBuffer(sender.mfp),
        );
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
          receivers[i].script,
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

  describe('signDummy', () => {
    it('clones a psbt, then sign it and returns an PsbtService object', async () => {
      const { service, sender } = await preparePsbt();

      const signedService = await service.signDummy(sender.signer);

      expect(signedService).toBeInstanceOf(PsbtService);
    });

    it('throws `Failed to sign dummy in PSBT` error if signDummy is failed', async () => {
      const { service, sender, finalizeSpy } = await preparePsbt();

      finalizeSpy.mockImplementation(() => {
        throw new Error('error');
      });

      await expect(service.signDummy(sender.signer)).rejects.toThrow(
        `Failed to sign dummy in PSBT`,
      );
    });
  });

  describe('getFee', () => {
    it('extracts fee from the psbt', async () => {
      const { service, sender } = await preparePsbt();

      const signedService = await service.signDummy(sender.signer);

      const fee = signedService.getFee();

      expect(fee).toBeGreaterThan(0);
    });

    it('throws `Failed to get fee from PSBT` error if getFee is failed', async () => {
      const { service } = await preparePsbt();

      expect(() => service.getFee()).toThrow(`Failed to get fee from PSBT`);
    });
  });
});
