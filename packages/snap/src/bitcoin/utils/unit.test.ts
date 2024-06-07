import { DustLimit, ScriptType, maxSatoshi, minSatoshi } from '../constants';
import { satsToBtc, btcToSats, isDust } from './unit';

describe('satsToBtc', () => {
  it('returns Btc unit', () => {
    expect(satsToBtc(2099999999999999n)).toBe('20999999.99999999');
  });

  it('returns Btc unit with max Satoshis', () => {
    expect(satsToBtc(maxSatoshi)).toBe('21000000.00000000');
  });

  it('returns Btc unit with min Satoshis', () => {
    expect(satsToBtc(minSatoshi)).toBe('0.00000001');
  });

  it('throw an error if then given Satoshis in float', () => {
    const sats = 1.1;
    expect(() => satsToBtc(sats)).toThrow(Error);
  });
});

describe('btcToSats', () => {
  it('returns Btc unit', () => {
    expect(btcToSats('20999999.99999999')).toBe(2099999999999999n);
  });

  it('returns Btc unit with max Satoshis', () => {
    expect(btcToSats('21000000')).toBe(2100000000000000n);
  });

  it('returns Btc unit with 0 Satoshis', () => {
    expect(btcToSats('0')).toBe(0n);
  });

  it('returns Btc unit with min Satoshis', () => {
    expect(btcToSats('0.00000001')).toBe(1n);
  });

  it('throws an error if the given BTC is out of range', () => {
    expect(() => btcToSats('0.9999999999999')).toThrow(
      'BTC amount is out of range',
    );
    expect(() => btcToSats('21000000.999999999"')).toThrow(
      'BTC amount is out of range',
    );
    expect(() => btcToSats('22000000')).toThrow('BTC amount is out of range');
  });
});

describe('isDust', () => {
  it('returns result', () => {
    expect(isDust(DustLimit[ScriptType.P2wpkh] + 1, ScriptType.P2wpkh)).toBe(
      false,
    );
    expect(
      isDust(BigInt(DustLimit[ScriptType.P2wpkh] + 1), ScriptType.P2wpkh),
    ).toBe(false);
    expect(
      isDust(BigInt(DustLimit[ScriptType.P2wpkh] - 1), ScriptType.P2wpkh),
    ).toBe(true);
  });
});
