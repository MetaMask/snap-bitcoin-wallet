import * as biplib from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { ScriptType } from '../constants';
import { getBtcPaymentInst } from './payment';

jest.mock('bitcoinjs-lib', () => {
  return {
    ...jest.requireActual('bitcoinjs-lib'),
    payments: {
      p2pkh: jest.fn(),
      p2sh: jest.fn(),
      p2wpkh: jest.fn(),
    },
  };
});

class MockPayment implements biplib.Payment {}

const createMockPayment = (type) => {
  const spy = jest.spyOn(biplib.payments, type);
  spy.mockReturnValue(new MockPayment());
  return {
    spy,
  };
};

describe('getBtcPaymentInst', () => {
  it('returns P2pkh payment instance', () => {
    const { spy } = createMockPayment('p2pkh');
    const pubkey = Buffer.from('pubkey', 'hex');

    const result = getBtcPaymentInst(
      ScriptType.P2pkh,
      pubkey,
      biplib.networks.testnet,
    );

    expect(spy).toHaveBeenCalledWith({
      pubkey,
      network: biplib.networks.testnet,
    });
    expect(result).toBeInstanceOf(MockPayment);
  });

  it('returns P2shP2wkh payment instance', () => {
    const { spy: p2shSpy } = createMockPayment('p2sh');
    const { spy: p2wpkhSpy } = createMockPayment('p2wpkh');
    const pubkey = Buffer.from('pubkey', 'hex');

    const result = getBtcPaymentInst(
      ScriptType.P2shP2wkh,
      pubkey,
      biplib.networks.testnet,
    );

    expect(p2wpkhSpy).toHaveBeenCalledWith({
      pubkey,
      network: biplib.networks.testnet,
    });
    expect(p2shSpy).toHaveBeenCalledWith({
      redeem: expect.any(MockPayment),
      network: biplib.networks.testnet,
    });
    expect(result).toBeInstanceOf(MockPayment);
  });

  it('returns P2wpkh payment instance', () => {
    const { spy } = createMockPayment('p2wpkh');
    const pubkey = Buffer.from('pubkey', 'hex');

    const result = getBtcPaymentInst(
      ScriptType.P2wpkh,
      pubkey,
      biplib.networks.testnet,
    );

    expect(spy).toHaveBeenCalledWith({
      pubkey,
      network: biplib.networks.testnet,
    });
    expect(result).toBeInstanceOf(MockPayment);
  });

  it('throws `Invalid script type` if the given type is not supported', () => {
    const pubkey = Buffer.from('pubkey', 'hex');

    expect(() =>
      getBtcPaymentInst(
        'sometype' as unknown as ScriptType,
        pubkey,
        biplib.networks.testnet,
      ),
    ).toThrow('Invalid script type');
  });
});
