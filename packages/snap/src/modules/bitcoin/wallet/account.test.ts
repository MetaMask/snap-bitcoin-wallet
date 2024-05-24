import type { Network, Payment } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import type { IAccountSigner } from '../../wallet';
import { ScriptType } from '../constants';
import * as utils from '../utils/payment';
import { P2WPKHAccount } from './account';

describe('BtcAccount', () => {
  const createMockPaymentInstance = (address: string | undefined) => {
    const getPaymentSpy = jest.spyOn(utils, 'getBtcPaymentInst');
    getPaymentSpy.mockReturnValue({
      address,
    } as unknown as Payment);
    return {
      getPaymentSpy,
    };
  };

  const createMockAccount = async (network: Network) => {
    const signerSpy = jest.fn();
    const index = 0;
    const hdPath = [`m`, `0'`, `0`, `${index}`].join('/');

    const instance = new P2WPKHAccount(
      'ddddddddddddd',
      index,
      hdPath,
      'ddddddddddddd',
      network,
      P2WPKHAccount.scriptType,
      `bip122:${P2WPKHAccount.scriptType.toLowerCase()}`,
      { sign: signerSpy } as unknown as IAccountSigner,
    );

    return {
      instance,
      signerSpy,
    };
  };

  describe('address', () => {
    it('returns an address', async () => {
      const network = networks.testnet;
      const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';
      const { getPaymentSpy } = createMockPaymentInstance(address);
      const { instance } = await createMockAccount(network);

      expect(instance.address).toStrictEqual(address);
      expect(getPaymentSpy).toHaveBeenCalledWith(
        ScriptType.P2wpkh,
        Buffer.from(instance.pubkey, 'hex'),
        network,
      );
    });

    it('returns an address if it exists', async () => {
      const network = networks.testnet;
      const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';
      const { getPaymentSpy } = createMockPaymentInstance(address);
      const { instance } = await createMockAccount(network);

      let instanceAddress = instance.address;

      expect(instanceAddress).toStrictEqual(address);

      instanceAddress = instance.address;
      expect(getPaymentSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error if the payment address is undefined', async () => {
      const network = networks.testnet;
      createMockPaymentInstance(undefined);
      const { instance } = await createMockAccount(network);

      expect(() => instance.address).toThrow('Payment address is missing');
    });
  });
});
