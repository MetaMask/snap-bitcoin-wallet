import { DustLimit, ScriptType } from '../constants';
import { isDust } from './policy';

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
