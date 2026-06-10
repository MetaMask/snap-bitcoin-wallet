import type { AddressType } from '@metamask/bitcoindevkit';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { BitcoinAccount } from '../entities';
import {
  canonicalizeBitcoinAddress,
  ComputeFeeRequest,
  FillPsbtRequest,
  parseProofOfOwnershipMessage,
  parseRewardsMessage,
  SendTransferRequest,
  SignPsbtRequest,
  validateDustLimit,
  validateSelectedAccounts,
} from './validation';

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
  describe('feeRate request validation', () => {
    const account = { account: { address: 'test-account-address' } };
    const optionalFeeRate = (feeRate?: number) =>
      feeRate === undefined ? {} : { feeRate };
    const requestCases: {
      name: string;
      assertParams: (feeRate?: number) => void;
    }[] = [
      {
        name: 'SignPsbtRequest',
        assertParams: (feeRate?: number) =>
          assert(
            {
              ...account,
              psbt: 'psbtBase64',
              ...optionalFeeRate(feeRate),
              options: { fill: false, broadcast: true },
            },
            SignPsbtRequest,
          ),
      },
      {
        name: 'FillPsbtRequest',
        assertParams: (feeRate?: number) =>
          assert(
            {
              ...account,
              psbt: 'psbtBase64',
              ...optionalFeeRate(feeRate),
            },
            FillPsbtRequest,
          ),
      },
      {
        name: 'ComputeFeeRequest',
        assertParams: (feeRate?: number) =>
          assert(
            {
              ...account,
              psbt: 'psbtBase64',
              ...optionalFeeRate(feeRate),
            },
            ComputeFeeRequest,
          ),
      },
      {
        name: 'SendTransferRequest',
        assertParams: (feeRate?: number) =>
          assert(
            {
              ...account,
              recipients: [
                {
                  address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
                  amount: '1000',
                },
              ],
              ...optionalFeeRate(feeRate),
            },
            SendTransferRequest,
          ),
      },
    ];

    describe.each(requestCases)('$name', ({ assertParams }) => {
      it('accepts an omitted feeRate', () => {
        expect(() => assertParams()).not.toThrow();
      });

      it.each([1, 2.4, 3])('accepts feeRate %p', (feeRate) => {
        expect(() => assertParams(feeRate)).not.toThrow();
      });

      it.each([
        ['zero', 0],
        ['below minimum', 0.5],
        ['negative', -5],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['-Infinity', -Infinity],
      ])('rejects %s feeRate', (_description, feeRate) => {
        expect(() => assertParams(feeRate)).toThrow('At path: feeRate');
      });
    });
  });

  describe('validateDustLimit', () => {
    const makeAccount = (addressType: AddressType) =>
      mock<BitcoinAccount>({ addressType });

    it.each<{ type: AddressType; dust: bigint }>([
      { type: 'p2pkh', dust: 546n },
      { type: 'p2sh', dust: 540n },
      { type: 'p2wsh', dust: 330n },
      { type: 'p2tr', dust: 330n },
      { type: 'p2wpkh', dust: 294n },
    ])(
      'returns valid for amount above dust limit for $type',
      ({ type, dust }) => {
        const amountBtc = (Number(dust) / 1e8 + 0.00000001).toFixed(8);
        const mockFromBtc = { to_sat: () => dust + 1n };
        const { Amount } = jest.requireMock('@metamask/bitcoindevkit');
        Amount.from_btc.mockReturnValue(mockFromBtc);

        const result = validateDustLimit(amountBtc, makeAccount(type));
        expect(result.valid).toBe(true);
      },
    );

    it('returns invalid for amount below dust limit', () => {
      const mockFromBtc = { to_sat: () => 100n };
      const { Amount } = jest.requireMock('@metamask/bitcoindevkit');
      Amount.from_btc.mockReturnValue(mockFromBtc);

      const result = validateDustLimit('0.000001', makeAccount('p2pkh'));
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSelectedAccounts', () => {
    it('does not throw when all account IDs exist', () => {
      expect(() =>
        validateSelectedAccounts(new Set(['a', 'b']), ['a', 'b', 'c']),
      ).not.toThrow();
    });

    it('throws when an account ID does not exist', () => {
      expect(() =>
        validateSelectedAccounts(new Set(['a', 'x']), ['a', 'b']),
      ).toThrow('Account IDs were not part of existing accounts.');
    });
  });

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

  describe('parseProofOfOwnershipMessage', () => {
    const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const nonce = 'a1b2c3d4e5f6789012345678';

    it('extracts the nonce and address from a valid message', () => {
      const result = parseProofOfOwnershipMessage(
        `metamask:proof-of-ownership:${nonce}:${address}`,
      );
      expect(result).toStrictEqual({ nonce, address });
    });

    it.each([
      `rewards,${address},123`,
      `metamask:proof:${nonce}:${address}`,
      `Metamask:proof-of-ownership:${nonce}:${address}`,
      `${nonce}:${address}`,
      '',
    ])('rejects messages without the expected prefix: "%s"', (message) => {
      expect(() => parseProofOfOwnershipMessage(message)).toThrow(
        'Message must start with "metamask:proof-of-ownership:"',
      );
    });

    it('rejects messages missing the address separator', () => {
      expect(() =>
        parseProofOfOwnershipMessage(
          `metamask:proof-of-ownership:${nonce}`,
        ),
      ).toThrow('Message must follow the format');
    });

    it('rejects messages with an empty nonce', () => {
      expect(() =>
        parseProofOfOwnershipMessage(
          `metamask:proof-of-ownership::${address}`,
        ),
      ).toThrow('non-empty nonce');
    });

    it('rejects messages with an empty address', () => {
      expect(() =>
        parseProofOfOwnershipMessage(
          `metamask:proof-of-ownership:${nonce}:`,
        ),
      ).toThrow('non-empty address');
    });
  });

  describe('canonicalizeBitcoinAddress', () => {
    it('lowercases bech32 P2WPKH addresses', () => {
      expect(
        canonicalizeBitcoinAddress(
          'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ',
        ),
      ).toBe('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    });

    it('lowercases bech32m P2TR addresses', () => {
      expect(
        canonicalizeBitcoinAddress(
          'BC1PMFR3P9J00PFXJH0ZMGP99Y8ZFTMD3S5PMEDQHYPTWY6LYLEX2GYS2WAMVS',
        ),
      ).toBe(
        'bc1pmfr3p9j00pfxjh0zmgp99y8zftmd3s5pmedqhyptwy6lylex2gys2wamvs',
      );
    });

    it.each(['tb1q...', 'TB1Q...', 'bcrt1q...', 'BCRT1Q...'])(
      'lowercases bech32 testnet and regtest addresses: "%s"',
      (input) => {
        expect(canonicalizeBitcoinAddress(input)).toBe(input.toLowerCase());
      },
    );

    it('leaves legacy base58check P2PKH addresses unchanged', () => {
      expect(
        canonicalizeBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
      ).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    });

    it('leaves legacy base58check P2SH addresses unchanged', () => {
      expect(
        canonicalizeBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'),
      ).toBe('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
    });
  });
});
