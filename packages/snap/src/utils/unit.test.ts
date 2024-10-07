import {
  satsToBtc,
  btcToSats,
  maxSatoshi,
  minSatoshi,
  satsKvbToVb,
} from './unit';

describe('satsKvbToVB', () => {
  it.each([
    { kvb: 1000n, vb: 1n },
    { kvb: 1001n, vb: 1n },
    { kvb: 1499n, vb: 1n },
    { kvb: 1500n, vb: 2n },
    { kvb: 1501n, vb: 2n },
    { kvb: 1999n, vb: 2n },
    { kvb: 123456789123456789n, vb: 123456789123457n },
  ])('converts from "$kvb" (sats/kvB) to "$vb" (sats/vB)', ({ kvb, vb }) => {
    expect(satsKvbToVb(kvb)).toBe(vb);
  });

  it.each([0, 1, 500, 999])('throws an error if not convertible: %s', (kvb) => {
    expect(() => satsKvbToVb(kvb)).toThrow(Error);
  });
});

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

  it('returns Btc unit with unit', () => {
    expect(satsToBtc(minSatoshi, true)).toBe('0.00000001 BTC');
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
