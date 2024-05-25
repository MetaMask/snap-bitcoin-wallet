import ecc from '@bitcoinerlab/secp256k1';
import type { SLIP10NodeInterface } from '@metamask/key-tree';
import { BIP32Factory } from 'bip32';
import { Transaction, networks } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';

import { generateFormatedUtxos } from '../../../../test/utils';
import { hexToBuffer } from '../../../utils';
import { SnapHelper } from '../../snap';
import { MaxStandardTxWeight, ScriptType } from '../constants';
import { BtcAccountBip32Deriver } from './deriver';
import { PsbtServiceError } from './exceptions';
import { PsbtService } from './psbt';
import { BtcWallet } from './wallet';

jest.mock('../../logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PsbtService', () => {
  const createMockBip32Instance = (network) => {
    const ECPair = ECPairFactory(ecc);
    const bip32 = BIP32Factory(ecc);

    const keyPair = ECPair.makeRandom();
    const deriver = bip32.fromSeed(keyPair.publicKey, network);

    const jsonData = {
      privateKey: deriver.privateKey?.toString('hex'),
      publicKey: deriver.publicKey.toString('hex'),
      chainCode: deriver.chainCode.toString('hex'),
      depth: deriver.depth,
      index: deriver.index,
      curve: 'secp256k1',
      masterFingerprint: undefined,
      parentFingerprint: 0,
    };
    jest.spyOn(SnapHelper, 'getBip32Deriver').mockResolvedValue({
      ...jsonData,
      chainCodeBytes: deriver.chainCode,
      privateKeyBytes: deriver.privateKey,
      publicKeyBytes: deriver.publicKey,
      toJSON: jest.fn().mockReturnValue(jsonData),
    } as unknown as SLIP10NodeInterface);

    return {
      instance: new BtcAccountBip32Deriver(network),
    };
  };

  const createMockWallet = (network) => {
    const { instance: deriver } = createMockBip32Instance(network);

    const instance = new BtcWallet(deriver, network);
    return {
      instance,
    };
  };

  describe('constructor', () => {
    const preparePsbt = async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const sender = await wallet.instance.unlock(0, ScriptType.P2wpkh);
      const mfpBuf = hexToBuffer(sender.mfp, false);
      const pubkeyBuf = hexToBuffer(sender.pubkey, false);
      const receiver1 = await wallet.instance.unlock(1, ScriptType.P2wpkh);
      const receiver2 = await wallet.instance.unlock(2, ScriptType.P2wpkh);
      const receivers = [receiver1, receiver2];
      const finalizeSpy = jest.spyOn(service.psbt, 'finalizeAllInputs');
      const outputVal = 1000;
      const fee = 500;
      const outputs = receivers.map((account) => ({
        address: account.address,
        value: outputVal,
      }));
      // it has to limit the inputs because it may fail due to alert of paying too much gas fee
      const inputs = generateFormatedUtxos(
        sender.address,
        1,
        outputVal * outputs.length + fee,
        outputVal * outputs.length + fee,
      );

      service.addOutputs(outputs);

      service.addInputs(
        inputs,
        mfpBuf,
        pubkeyBuf,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sender.payment.output!,
        sender.hdPath,
        true,
      );

      return {
        service,
        sender,
        finalizeSpy,
      };
    };

    it('constructor with a new psbt object', async () => {
      const network = networks.testnet;

      const service = new PsbtService(network);

      expect(service.psbt.txInputs).toHaveLength(0);
    });

    it('constructor with an psbt base string', async () => {
      const { service } = await preparePsbt();
      const psbtBase64 = service.toBase64();

      const newService = PsbtService.fromBase64(networks.testnet, psbtBase64);

      expect(newService.psbt.txInputs).toHaveLength(1);
      expect(newService.psbt.txOutputs).toHaveLength(2);
    });
  });

  describe('addInputs', () => {
    it('adds witnessUtxos to psbt object', async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const account = await wallet.instance.unlock(0, ScriptType.P2wpkh);
      const inputs = generateFormatedUtxos(account.address, 2);
      const mfpBuf = hexToBuffer(account.mfp, false);
      const pubkeyBuf = hexToBuffer(account.pubkey, false);
      const psbtSpy = jest.spyOn(service.psbt, 'addInput');

      service.addInputs(
        inputs,
        mfpBuf,
        pubkeyBuf,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        account.payment.output!,
        account.hdPath,
        false,
      );

      expect(service.psbt.txInputs).toHaveLength(2);

      for (let i = 0; i < inputs.length; i++) {
        expect(psbtSpy).toHaveBeenNthCalledWith(i + 1, {
          hash: inputs[i].txnHash,
          index: inputs[i].index,
          witnessUtxo: {
            script: account.payment.output,
            value: inputs[i].value,
          },
          bip32Derivation: [
            {
              masterFingerprint: mfpBuf,
              path: account.hdPath,
              pubkey: pubkeyBuf,
            },
          ],
          sequence: Transaction.DEFAULT_SEQUENCE,
        });
      }
    });

    it('opt-ins RBF into the psbt input', async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const account = await wallet.instance.unlock(0, ScriptType.P2wpkh);
      const inputs = generateFormatedUtxos(account.address, 2);
      const mfpBuf = hexToBuffer(account.mfp, false);
      const pubkeyBuf = hexToBuffer(account.pubkey, false);
      const psbtSpy = jest.spyOn(service.psbt, 'addInput');

      service.addInputs(
        inputs,
        mfpBuf,
        pubkeyBuf,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        account.payment.output!,
        account.hdPath,
        true,
      );

      for (let i = 0; i < inputs.length; i++) {
        expect(psbtSpy).toHaveBeenNthCalledWith(i + 1, {
          hash: inputs[i].txnHash,
          index: inputs[i].index,
          witnessUtxo: {
            script: account.payment.output,
            value: inputs[i].value,
          },
          bip32Derivation: [
            {
              masterFingerprint: mfpBuf,
              path: account.hdPath,
              pubkey: pubkeyBuf,
            },
          ],
          sequence: Transaction.DEFAULT_SEQUENCE - 2,
        });
      }
    });

    it('throws `Failed to add inputs in PSBT` error if adding inputs fails', async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const account = await wallet.instance.unlock(0, ScriptType.P2wpkh);
      const inputs = generateFormatedUtxos(account.address, 2);
      const mfpBuf = hexToBuffer(account.mfp, false);
      const pubkeyBuf = hexToBuffer(account.pubkey, false);

      jest.spyOn(service.psbt, 'addInput').mockImplementation(() => {
        throw new Error('error');
      });

      expect(() => {
        service.addInputs(
          inputs,
          mfpBuf,
          pubkeyBuf,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          account.payment.output!,
          account.hdPath,
          true,
        );
      }).toThrow('Failed to add inputs in PSBT');
    });
  });

  describe('addOutputs', () => {
    it('adds outputs to psbt object', async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const receiver1 = await wallet.instance.unlock(1, ScriptType.P2wpkh);
      const receiver2 = await wallet.instance.unlock(2, ScriptType.P2wpkh);
      const receivers = [receiver1, receiver2];

      const outputs = receivers.map((account) => ({
        address: account.address,
        value: 1000,
      }));

      service.addOutputs(outputs);

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
      const network = networks.testnet;
      const service = new PsbtService(network);

      const outputs = [
        {
          address: 'address',
          value: 1000,
        },
      ];

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
    const prepareToSign = async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const sender = await wallet.instance.unlock(0, ScriptType.P2wpkh);
      const inputs = generateFormatedUtxos(sender.address, 2);
      const mfpBuf = hexToBuffer(sender.mfp, false);
      const pubkeyBuf = hexToBuffer(sender.pubkey, false);
      const receiver1 = await wallet.instance.unlock(1, ScriptType.P2wpkh);
      const receiver2 = await wallet.instance.unlock(2, ScriptType.P2wpkh);
      const receivers = [receiver1, receiver2];
      const signSpy = jest.spyOn(service.psbt, 'signAllInputsHDAsync');
      const verifySpy = jest.spyOn(
        service.psbt,
        'validateSignaturesOfAllInputs',
      );

      const outputs = receivers.map((account) => ({
        address: account.address,
        value: 1000,
      }));

      service.addOutputs(outputs);

      service.addInputs(
        inputs,
        mfpBuf,
        pubkeyBuf,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sender.payment.output!,
        sender.hdPath,
        true,
      );

      return {
        service,
        sender,
        signSpy,
        verifySpy,
      };
    };

    it('signs all inputs with the given signer', async () => {
      const { service, sender, signSpy, verifySpy } = await prepareToSign();

      await service.signNVerify(sender.signer);

      expect(signSpy).toHaveBeenCalledWith(sender.signer);
      expect(verifySpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it("throws `Invalid signature to sign the PSBT's inputs` error if signature is incorrect", async () => {
      const { service, sender, verifySpy } = await prepareToSign();

      verifySpy.mockReturnValue(false);

      await expect(service.signNVerify(sender.signer)).rejects.toThrow(
        "Invalid signature to sign the PSBT's inputs",
      );
    });
  });

  describe('finalize', () => {
    const prepareToFinalize = async () => {
      const network = networks.testnet;
      const service = new PsbtService(network);
      const wallet = createMockWallet(network);
      const sender = await wallet.instance.unlock(0, ScriptType.P2wpkh);
      const mfpBuf = hexToBuffer(sender.mfp, false);
      const pubkeyBuf = hexToBuffer(sender.pubkey, false);
      const receiver1 = await wallet.instance.unlock(1, ScriptType.P2wpkh);
      const receiver2 = await wallet.instance.unlock(2, ScriptType.P2wpkh);
      const receivers = [receiver1, receiver2];

      const finalizeSpy = jest.spyOn(service.psbt, 'finalizeAllInputs');
      const transactionWeightSpy = jest.spyOn(Transaction.prototype, 'weight');
      const transactionHexSpy = jest.spyOn(Transaction.prototype, 'toHex');

      const outputVal = 1000;
      const fee = 500;
      const outputs = receivers.map((account) => ({
        address: account.address,
        value: outputVal,
      }));
      // it has to limit the inputs because it may fail due to alert of paying too much gas fee
      const inputs = generateFormatedUtxos(
        sender.address,
        1,
        outputVal * outputs.length + fee,
        outputVal * outputs.length + fee,
      );

      service.addOutputs(outputs);

      service.addInputs(
        inputs,
        mfpBuf,
        pubkeyBuf,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sender.payment.output!,
        sender.hdPath,
        true,
      );

      await service.signNVerify(sender.signer);

      return {
        service,
        sender,
        finalizeSpy,
        transactionWeightSpy,
        transactionHexSpy,
      };
    };

    it('returns an transaction hex', async () => {
      const { service, finalizeSpy, transactionHexSpy } =
        await prepareToFinalize();

      const txHex = service.finalize();

      expect(txHex).not.toBeNull();
      expect(txHex).not.toBe('');
      expect(finalizeSpy).toHaveBeenCalled();
      expect(transactionHexSpy).toHaveBeenCalled();
    });

    it('throws `Transaction is too large` error if the txn weight is too large', async () => {
      const { service, transactionWeightSpy } = await prepareToFinalize();

      transactionWeightSpy.mockReturnValue(MaxStandardTxWeight + 1000);

      expect(() => service.finalize()).toThrow(`Transaction is too large`);
    });

    it('throws PsbtServiceError error if finalize operation failed', async () => {
      const { service, finalizeSpy } = await prepareToFinalize();

      finalizeSpy.mockImplementation(() => {
        throw new Error('error');
      });

      expect(() => service.finalize()).toThrow(PsbtServiceError);
    });
  });
});
