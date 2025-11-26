import { parseRewardsMessage } from './validation';

/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Address: {
    from_string: jest.fn(),
  },
  Amount: {
    from_btc: jest.fn(),
  },
}));

describe('validation', () => {
  describe('parseRewardsMessage', () => {
    const validBitcoinMainnetAddress =
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const toBase64 = (utf8: string): string => btoa(utf8);

    describe('valid parsing', () => {
      it('correctly extracts address and timestamp from valid message', () => {
        const expectedAddress = validBitcoinMainnetAddress;
        const expectedTimestamp = 1736660000;
        const utf8Message = `rewards,${expectedAddress},${expectedTimestamp}`;
        const base64Message = toBase64(utf8Message);

        const result = parseRewardsMessage(base64Message);

        expect(result.address).toBe(expectedAddress);
        expect(result.timestamp).toBe(expectedTimestamp);
      });
    });

    describe('invalid messages', () => {
      it('rejects string that decodes but not rewards format', () => {
        const base64Message = 'hello world';
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Message must start with "rewards,"',
        );
      });

      it('rejects empty string', () => {
        const base64Message = '';
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Message must start with "rewards,"',
        );
      });

      it('rejects invalid base64 with special characters', () => {
        const base64Message = '!!!@@@###';
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Invalid base64 encoding',
        );
      });
    });

    describe('invalid message prefix', () => {
      it.each([
        {
          message: `reward,${validBitcoinMainnetAddress},${currentTimestamp}`,
          description: "missing 's'",
        },
        {
          message: `Rewards,${validBitcoinMainnetAddress},${currentTimestamp}`,
          description: 'wrong case (capitalized)',
        },
        {
          message: `bonus,${validBitcoinMainnetAddress},${currentTimestamp}`,
          description: 'wrong prefix',
        },
        {
          message: `${validBitcoinMainnetAddress},${currentTimestamp}`,
          description: 'no prefix',
        },
        {
          message: `REWARDS,${validBitcoinMainnetAddress},${currentTimestamp}`,
          description: 'all caps',
        },
      ])(
        'rejects message that does not start with "rewards,": $description',
        ({ message: utf8Message }) => {
          const base64Message = toBase64(utf8Message);
          expect(() => parseRewardsMessage(base64Message)).toThrow(
            'Message must start with "rewards,"',
          );
        },
      );
    });

    describe('invalid message structure', () => {
      it('rejects message with only prefix', () => {
        const utf8Message = 'rewards,';
        const base64Message = toBase64(utf8Message);
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Message must have exactly 3 parts',
        );
      });

      it('rejects message missing timestamp', () => {
        const utf8Message = `rewards,${validBitcoinMainnetAddress}`;
        const base64Message = toBase64(utf8Message);
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Message must have exactly 3 parts',
        );
      });

      it('rejects message with too many parts', () => {
        const utf8Message = `rewards,${validBitcoinMainnetAddress},${currentTimestamp},extra`;
        const base64Message = toBase64(utf8Message);
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Message must have exactly 3 parts',
        );
      });

      it('rejects message with empty parts', () => {
        const utf8Message = 'rewards,,,';
        const base64Message = toBase64(utf8Message);
        expect(() => parseRewardsMessage(base64Message)).toThrow(/timestamp/iu);
      });

      it('rejects message with only prefix without comma', () => {
        const utf8Message = 'rewards';
        const base64Message = toBase64(utf8Message);
        expect(() => parseRewardsMessage(base64Message)).toThrow(
          'Message must start with "rewards,"',
        );
      });
    });

    describe('invalid timestamps', () => {
      it.each([
        {
          timestamp: 'invalid',
          description: 'non-numeric',
        },
        {
          timestamp: '',
          description: 'empty timestamp',
        },
        {
          timestamp: '-1',
          description: 'negative timestamp',
        },
        {
          timestamp: '0',
          description: 'zero timestamp',
        },
        {
          timestamp: '123.456',
          description: 'decimal timestamp',
        },
        {
          timestamp: '1.0',
          description: 'decimal with .0',
        },
        {
          timestamp: 'abc123',
          description: 'alphanumeric',
        },
      ])(
        'rejects message with invalid timestamp: $description',
        ({ timestamp }) => {
          const utf8Message = `rewards,${validBitcoinMainnetAddress},${timestamp}`;
          const base64Message = toBase64(utf8Message);

          expect(() => parseRewardsMessage(base64Message)).toThrow(
            /timestamp/iu,
          );
        },
      );
    });
  });
});
