import { DustLimit, ScriptType } from '../constants';
import { satsToBtc, btcToSats, isDust } from './unit';

describe('satsToBtc', () => {
  it('returns Btc unit', () => {
    // impossible test case
    // 20999999999999999 will overflow become 210000000.00000000
    expect(satsToBtc(2099999999999999)).toBe('20999999.99999999');
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
    // impossible test case
    // 49999999.999999999 will overflow become 5000000000000000
    expect(btcToSats(4.999999999)).toBe('499999999.9');
  });

  it('returns Btc unit with max Satoshis', () => {
    expect(btcToSats(210000000)).toBe('21000000000000000');
  });

  it('returns Btc unit with min Satoshis', () => {
    expect(btcToSats(0.00000001)).toBe('1');
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
