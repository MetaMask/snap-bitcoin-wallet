import { DustLimit, ScriptType } from '../constants';
import { satsToBtc, btcToSats, isDust } from './unit';

describe('satsToBtc', () => {
  it('returns Btc unit', () => {
    const sats = 1234567899;
    expect(satsToBtc(sats)).toBe('12.34567899');
  });

  it('returns Btc unit with max Satoshis', () => {
    const maxSats = 21 * Math.pow(10, 15);

    expect(satsToBtc(maxSats)).toBe('210000000.00000000');
  });

  it('returns Btc unit with min Satoshis', () => {
    const minSats = 1;
    expect(satsToBtc(minSats)).toBe('0.00000001');
  });

  it('throw an error if then given Satoshis in float', () => {
    const sats = 1.1;
    expect(() => satsToBtc(sats)).toThrow(Error);
  });
});

describe('btcToSats', () => {
  it('returns Btc unit', () => {
    const sats = 1234567899;
    const btc = satsToBtc(sats);
    expect(btcToSats(parseFloat(btc))).toBe('1234567899');
  });

  it('returns Btc unit with max Satoshis', () => {
    const maxSats = 21 * Math.pow(10, 15);
    const btc = satsToBtc(maxSats);
    expect(btcToSats(parseFloat(btc))).toBe('21000000000000000');
  });

  it('returns Btc unit with min Satoshis', () => {
    const minSats = 1;
    const btc = satsToBtc(minSats);
    expect(btcToSats(parseFloat(btc))).toBe('1');
  });
});

describe('isDust', () => {
  it('returns result', () => {
    expect(isDust(DustLimit[ScriptType.P2wpkh] + 1, ScriptType.P2wpkh)).toBe(
      false,
    );
    expect(isDust(DustLimit[ScriptType.P2wpkh] - 1, ScriptType.P2wpkh)).toBe(
      true,
    );
  });
});
