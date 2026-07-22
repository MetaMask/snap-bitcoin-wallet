import type {
  Amount,
  Transaction,
  Txid,
  TxOut,
  Network,
  WalletTx,
  AddressType,
  ScriptBuf,
} from '@metamask/bitcoindevkit';
import { Address } from '@metamask/bitcoindevkit';
import type {
  KeyringAccount,
  KeyringResponse,
  Transaction as KeyringTransaction,
  KeyringRequest,
} from '@metamask/keyring-api';
import {
  AccountCreationType,
  BtcAccountType,
  BtcMethod,
  BtcScope,
} from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { BitcoinAccount, Logger, SnapClient } from '../entities';
import { AccountCapability, CurrencyUnit } from '../entities';
import { Caip19Asset } from './caip';
import { KeyringHandler } from './KeyringHandler';
import type { KeyringRequestHandler } from './KeyringRequestHandler';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

jest.mock('wif', () => ({
  encode: jest.fn(() => 'K1WIFprivateKeyMockValue'),
}));

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => {
  return {
    Address: {
      from_script: jest.fn(),
    },
    Amount: {
      from_sat: (sats: bigint) => ({
        to_btc: () => Number(sats) / 100_000_000,
        to_sat: () => sats,
      }),
    },
  };
});

/**
 * Narrows `T | undefined` after `expect(value).toBeDefined()` for use in tests.
 *
 * @param value - Possibly undefined value.
 * @returns The same value narrowed to `T`.
 */
function expectDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

describe('KeyringHandler', () => {
  const mockKeyringRequest = mock<KeyringRequestHandler>();
  const mockAccounts = mock<AccountUseCases>();
  const mockSnapClient = mock<SnapClient>();
  const mockAddress = mock<Address>({
    toString: () => 'bc1qaddress...',
  });
  const mockLogger = mock<Logger>();

  // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
  /* eslint-disable @typescript-eslint/naming-convention */
  const mockAccount = mock<BitcoinAccount>({
    id: 'some-id',
    addressType: 'p2wpkh',
    balance: {
      trusted_spendable: { to_btc: () => 1, to_sat: () => 100_000_000n },
    },
    network: 'bitcoin',
    derivationPath: ['myEntropy', "84'", "0'", "0'"],
    entropySource: 'myEntropy',
    accountIndex: 0,
    publicAddress: mockAddress,
    capabilities: [AccountCapability.SignPsbt, AccountCapability.ComputeFee],
    listUnspent: () => [],
  });
  const defaultAddressType: AddressType = 'p2wpkh';

  const handler = new KeyringHandler(
    mockKeyringRequest,
    mockAccounts,
    defaultAddressType,
    mockSnapClient,
    mockLogger,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('createAccounts', () => {
    const entropySource = 'some-source';

    const mnemonicGroupIndex = (account: KeyringAccount): number => {
      const { entropy } = account.options;
      if (entropy?.type !== 'mnemonic') {
        throw new Error('expected mnemonic entropy');
      }
      return entropy.groupIndex;
    };

    const buildMockAccount = (index: number): BitcoinAccount =>
      mock<BitcoinAccount>({
        id: `id-${index}`,
        addressType: 'p2wpkh',
        balance: { trusted_spendable: { to_btc: () => 1 } },
        network: 'bitcoin',
        derivationPath: ['myEntropy', "84'", "0'", `${index}'`],
        entropySource: 'myEntropy',
        accountIndex: index,
        publicAddress: mockAddress,
        capabilities: [
          AccountCapability.SignPsbt,
          AccountCapability.ComputeFee,
        ],
      });

    it('creates a single account for Bip44DeriveIndex', async () => {
      const bitcoinAccount = buildMockAccount(2);
      mockAccounts.createMany.mockResolvedValue([bitcoinAccount]);

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndex,
        groupIndex: 2,
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledTimes(1);
      expect(mockAccounts.createMany).toHaveBeenCalledWith([
        {
          network: 'bitcoin',
          entropySource,
          index: 2,
          addressType: 'p2wpkh',
          synchronize: false,
        },
      ]);
      expect(result).toHaveLength(1);
      const keyringAccount = expectDefined(result[0]);
      expect(keyringAccount.id).toBe('id-2');
      expect(mnemonicGroupIndex(keyringAccount)).toBe(2);
    });

    it('creates an inclusive range of accounts for Bip44DeriveIndexRange', async () => {
      mockAccounts.createMany.mockResolvedValue(
        [0, 1, 2].map(buildMockAccount),
      );

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndexRange,
        range: { from: 0, to: 2 },
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledTimes(1);
      expect(mockAccounts.createMany).toHaveBeenCalledWith(
        [0, 1, 2].map((index) => ({
          network: 'bitcoin',
          entropySource,
          index,
          addressType: 'p2wpkh',
          synchronize: false,
        })),
      );
      expect(result).toHaveLength(3);
      expect(result.map((a) => mnemonicGroupIndex(a))).toStrictEqual([0, 1, 2]);
    });

    it('creates one account when range from and to are equal', async () => {
      mockAccounts.createMany.mockResolvedValue([buildMockAccount(9)]);

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndexRange,
        range: { from: 9, to: 9 },
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledTimes(1);
      expect(mockAccounts.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ index: 9 }),
      ]);
      expect(result).toHaveLength(1);
      expect(mnemonicGroupIndex(expectDefined(result[0]))).toBe(9);
    });

    it('creates accounts for a non-zero index range', async () => {
      mockAccounts.createMany.mockResolvedValue(
        [10, 11, 12].map(buildMockAccount),
      );

      await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndexRange,
        range: { from: 10, to: 12 },
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledWith(
        [10, 11, 12].map((index) => expect.objectContaining({ index })),
      );
    });

    it('allows the maximum batch size of 100 accounts in one RPC', async () => {
      const indices = Array.from({ length: 100 }, (_, index) => index);
      mockAccounts.createMany.mockResolvedValue(indices.map(buildMockAccount));

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndexRange,
        range: { from: 0, to: 99 },
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledTimes(1);
      expect(mockAccounts.createMany).toHaveBeenCalledWith(
        indices.map((index) => expect.objectContaining({ index })),
      );
      expect(result).toHaveLength(100);
      expect(mnemonicGroupIndex(expectDefined(result[0]))).toBe(0);
      expect(mnemonicGroupIndex(expectDefined(result[99]))).toBe(99);
    });

    it('returns accounts in the order returned by createMany', async () => {
      mockAccounts.createMany.mockResolvedValue(
        [0, 1, 2, 3, 4].map(buildMockAccount),
      );

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndexRange,
        range: { from: 0, to: 4 },
        entropySource,
      });

      expect(result.map((a) => mnemonicGroupIndex(a))).toStrictEqual([
        0, 1, 2, 3, 4,
      ]);
    });

    it('rejects when the handler default address type is not P2WPKH', async () => {
      const handlerNonSegwit = new KeyringHandler(
        mockKeyringRequest,
        mockAccounts,
        'p2tr' as AddressType,
        mockSnapClient,
        mockLogger,
      );

      await expect(
        handlerNonSegwit.createAccounts({
          type: AccountCreationType.Bip44DeriveIndex,
          groupIndex: 0,
          entropySource,
        }),
      ).rejects.toThrow(
        /Only native segwit \(P2WPKH\) addresses are supported/iu,
      );
      expect(mockAccounts.createMany).not.toHaveBeenCalled();
    });

    it('rejects an invalid index range when from is greater than to', async () => {
      await expect(
        handler.createAccounts({
          type: AccountCreationType.Bip44DeriveIndexRange,
          range: { from: 2, to: 0 },
          entropySource,
        }),
      ).rejects.toThrow(/invalid.*range|from must be/iu);
      expect(mockAccounts.createMany).not.toHaveBeenCalled();
    });

    it.each([
      { from: -1, to: 0 },
      { from: 0.5, to: 1 },
      { from: 0, to: Number.MAX_SAFE_INTEGER + 1 },
    ])('rejects invalid account index bounds %#', async (range) => {
      await expect(
        handler.createAccounts({
          type: AccountCreationType.Bip44DeriveIndexRange,
          range,
          entropySource,
        }),
      ).rejects.toThrow(/non-negative integers/iu);
      expect(mockAccounts.createMany).not.toHaveBeenCalled();
    });

    it('splits requests larger than 100 accounts into internal batches', async () => {
      mockAccounts.createMany.mockImplementation(async (requests) =>
        requests.map(({ index }) => buildMockAccount(index)),
      );

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DeriveIndexRange,
        range: { from: 0, to: 100 },
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledTimes(2);
      expect(mockAccounts.createMany).toHaveBeenNthCalledWith(
        1,
        Array.from({ length: 100 }, (_, index) =>
          expect.objectContaining({ index }),
        ),
      );
      expect(mockAccounts.createMany).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({ index: 100 }),
      ]);
      expect(result).toHaveLength(101);
      expect(
        result.map((account) => mnemonicGroupIndex(account)),
      ).toStrictEqual(Array.from({ length: 101 }, (_, index) => index));
    });

    it('rejects unsupported creation types', async () => {
      await expect(
        handler.createAccounts({
          type: 'bip44:unknown' as AccountCreationType,
          entropySource,
        } as Parameters<typeof handler.createAccounts>[0]),
      ).rejects.toThrow(/not supported|unsupported/iu);
      expect(mockAccounts.createMany).not.toHaveBeenCalled();
    });

    it('creates an account for Bip44DerivePath on mainnet', async () => {
      const bitcoinAccount = buildMockAccount(0);
      mockAccounts.createMany.mockResolvedValue([bitcoinAccount]);

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DerivePath,
        derivationPath: "m/84'/0'/0'",
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ network: 'bitcoin', index: 0 }),
      ]);
      expect(result).toHaveLength(1);
    });

    it('creates an account for Bip44DerivePath on regtest', async () => {
      const bitcoinAccount = buildMockAccount(3);
      mockAccounts.createMany.mockResolvedValue([bitcoinAccount]);

      const result = await handler.createAccounts({
        type: AccountCreationType.Bip44DerivePath,
        derivationPath: "m/84'/1'/3'",
        entropySource,
      });

      expect(mockAccounts.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ network: 'regtest', index: 3 }),
      ]);
      expect(result).toHaveLength(1);
    });

    it('rejects Bip44DerivePath with non-BIP84 purpose', async () => {
      await expect(
        handler.createAccounts({
          type: AccountCreationType.Bip44DerivePath,
          derivationPath: "m/44'/0'/0'",
          entropySource,
        }),
      ).rejects.toThrow(/Only native segwit \(BIP-84\)/iu);
      expect(mockAccounts.createMany).not.toHaveBeenCalled();
    });

    it('rejects Bip44DerivePath with unsupported coin type', async () => {
      await expect(
        handler.createAccounts({
          type: AccountCreationType.Bip44DerivePath,
          derivationPath: "m/84'/2'/0'",
          entropySource,
        }),
      ).rejects.toThrow(/Unsupported coin type/iu);
      expect(mockAccounts.createMany).not.toHaveBeenCalled();
    });

    it.each([
      {
        label: 'missing account segment',
        derivationPath: "m/84'/0'" as `m/${string}`,
      },
      {
        label: 'non-integer index',
        derivationPath: "m/84'/0'/abc'" as `m/${string}`,
      },
      {
        label: 'negative index',
        derivationPath: "m/84'/0'/-1'" as `m/${string}`,
      },
    ])(
      'rejects Bip44DerivePath with invalid account index ($label)',
      async ({ derivationPath }) => {
        await expect(
          handler.createAccounts({
            type: AccountCreationType.Bip44DerivePath,
            derivationPath,
            entropySource,
          }),
        ).rejects.toThrow(/Invalid derivation path/iu);
        expect(mockAccounts.createMany).not.toHaveBeenCalled();
      },
    );

    it('propagates errors from createMany', async () => {
      const error = new Error('create error');
      mockAccounts.createMany.mockRejectedValue(error);

      await expect(
        handler.createAccounts({
          type: AccountCreationType.Bip44DeriveIndex,
          groupIndex: 0,
          entropySource,
        }),
      ).rejects.toThrow(error);
    });

    describe('bip44:discover', () => {
      const buildDiscoveredAccount = (hasTxs: boolean): BitcoinAccount =>
        mock<BitcoinAccount>({
          id: 'discovered-id',
          addressType: 'p2wpkh',
          network: 'bitcoin',
          derivationPath: ['myEntropy', "84'", "0'", "0'"],
          entropySource: 'myEntropy',
          accountIndex: 0,
          publicAddress: mockAddress,
          capabilities: [
            AccountCapability.SignPsbt,
            AccountCapability.ComputeFee,
          ],
          listTransactions: jest.fn().mockReturnValue(hasTxs ? [{}] : []),
        });

      it('discovers then returns the account when it has on-chain history', async () => {
        mockAccounts.discover.mockResolvedValue(buildDiscoveredAccount(true));

        const result = await handler.createAccounts({
          type: AccountCreationType.Bip44Discover,
          groupIndex: 0,
          entropySource,
        });

        expect(mockAccounts.discover).toHaveBeenCalledWith({
          network: 'bitcoin',
          entropySource,
          index: 0,
          addressType: 'p2wpkh',
        });
        expect(mockAccounts.delete).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('discovered-id');
      });

      it('deletes the account and returns empty array when no on-chain history', async () => {
        const inactiveAccount = buildDiscoveredAccount(false);
        mockAccounts.discover.mockResolvedValue(inactiveAccount);

        const result = await handler.createAccounts({
          type: AccountCreationType.Bip44Discover,
          groupIndex: 0,
          entropySource,
        });

        expect(mockAccounts.discover).toHaveBeenCalled();
        expect(mockAccounts.delete).toHaveBeenCalledWith(inactiveAccount.id);
        expect(result).toHaveLength(0);
      });

      it('propagates errors from discover as SnapError', async () => {
        const error = new Error('discover error');
        mockAccounts.discover.mockRejectedValue(error);

        await expect(
          handler.createAccounts({
            type: AccountCreationType.Bip44Discover,
            groupIndex: 0,
            entropySource,
          }),
        ).rejects.toThrow('discover error');
      });
    });

    describe('tracing', () => {
      const options = {
        type: AccountCreationType.Bip44DeriveIndex as const,
        groupIndex: 0,
        entropySource,
      };

      beforeEach(() => {
        mockSnapClient.startTrace.mockResolvedValue(true);
        mockSnapClient.endTrace.mockResolvedValue(undefined);
        mockAccounts.createMany.mockResolvedValue([buildMockAccount(0)]);
      });

      it('calls startTrace and endTrace with correct trace name', async () => {
        await handler.createAccounts(options);

        expect(mockSnapClient.startTrace).toHaveBeenCalledWith(
          'Create Bitcoin Accounts Batch',
        );
        expect(mockSnapClient.endTrace).toHaveBeenCalledWith(
          'Create Bitcoin Accounts Batch',
        );
      });

      it('calls endTrace even if create fails', async () => {
        mockAccounts.createMany.mockRejectedValue(new Error('boom'));

        await expect(handler.createAccounts(options)).rejects.toThrow('boom');
        expect(mockSnapClient.endTrace).toHaveBeenCalledWith(
          'Create Bitcoin Accounts Batch',
        );
      });

      it('does not call endTrace when startTrace returns false', async () => {
        mockSnapClient.startTrace.mockResolvedValue(false);

        await handler.createAccounts(options);

        expect(mockSnapClient.startTrace).toHaveBeenCalledWith(
          'Create Bitcoin Accounts Batch',
        );
        expect(mockSnapClient.endTrace).not.toHaveBeenCalled();
      });
    });
  });

  describe('exportAccount', () => {
    const accountId = 'some-id';
    const fakeWif = 'K1WIFprivateKeyMockValue';
    const fakePrivateKey =
      '0xdeadbeefcafe0000000000000000000000000000000000000000000000000001';

    beforeEach(() => {
      mockAccounts.get.mockResolvedValue(mockAccount);
      mockSnapClient.getPrivateEntropy.mockResolvedValue({
        privateKey: fakePrivateKey,
      } as never);
      const { encode } = jest.requireMock<{ encode: jest.Mock }>('wif');
      encode.mockReturnValue(fakeWif);
    });

    it('exports account as WIF (base58) private key by default', async () => {
      const result = await handler.exportAccount(accountId);

      expect(mockAccounts.get).toHaveBeenCalledWith(accountId);
      expect(mockSnapClient.getPrivateEntropy).toHaveBeenCalledWith(
        mockAccount.derivationPath.concat(['0', '0']),
      );
      expect(result).toStrictEqual({
        type: 'private-key',
        encoding: 'base58',
        privateKey: fakeWif,
      });
    });

    it('exports account with explicit base58 encoding option', async () => {
      const result = await handler.exportAccount(accountId, {
        type: 'private-key',
        encoding: 'base58',
      });

      expect(result.encoding).toBe('base58');
      expect(result.privateKey).toBe(fakeWif);
    });

    it('throws for unsupported encoding', async () => {
      await expect(
        handler.exportAccount(accountId, {
          type: 'private-key',
          encoding: 'hexadecimal',
        }),
      ).rejects.toThrow('Only base58 (WIF) private key export is supported');
    });

    it('throws when private entropy is not available', async () => {
      mockSnapClient.getPrivateEntropy.mockResolvedValue({
        privateKey: undefined,
      } as never);

      await expect(handler.exportAccount(accountId)).rejects.toThrow(
        'Failed to get private entropy',
      );
    });

    it('wraps wif encoding errors in SnapError without leaking private key', async () => {
      const { encode } = jest.requireMock<{ encode: jest.Mock }>('wif');
      encode.mockImplementation(() => {
        throw new Error('encoding failed: privatekey=SENSITIVE');
      });

      const error = await handler
        .exportAccount(accountId)
        .catch((caughtError) => caughtError);
      // The SnapError message must not contain the sensitive encoding error
      expect(error.message).not.toContain('SENSITIVE');
      expect(error.message).toContain('exporting account');
    });
  });

  describe('getAccountBalances', () => {
    it('gets the account balance', async () => {
      mockAccounts.get.mockResolvedValue(mockAccount);
      const expectedResponse = {
        [Caip19Asset.Bitcoin]: {
          amount: '1',
          unit: 'BTC',
        },
      };

      const result = await handler.getAccountBalances(mockAccount.id);
      expect(mockAccounts.get).toHaveBeenCalledWith(mockAccount.id);
      expect(result).toStrictEqual(expectedResponse);
    });

    it('propagates errors from get', async () => {
      const error = new Error();
      mockAccounts.get.mockRejectedValue(error);

      await expect(handler.getAccountBalances(mockAccount.id)).rejects.toThrow(
        error,
      );
      expect(mockAccounts.get).toHaveBeenCalled();
    });
  });

  describe('getAccount', () => {
    it('gets account', async () => {
      mockAccounts.get.mockResolvedValue(mockAccount);
      const expectedKeyringAccount = {
        id: 'some-id',
        type: BtcAccountType.P2wpkh,
        scopes: [BtcScope.Mainnet],
        address: 'bc1qaddress...',
        options: {
          entropySource: 'myEntropy',
          entropy: {
            derivationPath: "m/84'/0'/0'",
            groupIndex: 0,
            id: 'myEntropy',
            type: 'mnemonic',
          },
          exportable: true,
        },
        methods: mockAccount.capabilities,
      };

      const result = await handler.getAccount('some-id');
      expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
      expect(result).toStrictEqual(expectedKeyringAccount);
    });

    it('propagates errors from get', async () => {
      const error = new Error();
      mockAccounts.get.mockRejectedValue(error);

      await expect(handler.getAccount('some-id')).rejects.toThrow(error);
      expect(mockAccounts.get).toHaveBeenCalled();
    });
  });

  describe('getAccounts', () => {
    it('lists accounts', async () => {
      mockAccounts.list.mockResolvedValue([mockAccount]);
      const expectedKeyringAccounts = [
        {
          id: 'some-id',
          type: BtcAccountType.P2wpkh,
          scopes: [BtcScope.Mainnet],
          address: 'bc1qaddress...',
          options: {
            entropySource: 'myEntropy',
            entropy: {
              derivationPath: "m/84'/0'/0'",
              groupIndex: 0,
              id: 'myEntropy',
              type: 'mnemonic',
            },
            exportable: true,
          },
          methods: mockAccount.capabilities,
        },
      ];

      const result = await handler.getAccounts();
      expect(mockAccounts.list).toHaveBeenCalled();
      expect(result).toStrictEqual(expectedKeyringAccounts);
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      mockAccounts.list.mockRejectedValue(error);

      await expect(handler.getAccounts()).rejects.toThrow(error);
      expect(mockAccounts.list).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('deletes account', async () => {
      await handler.deleteAccount('some-id');
      expect(mockAccounts.delete).toHaveBeenCalledWith('some-id');
    });

    it('propagates errors from delete', async () => {
      const error = new Error();
      mockAccounts.delete.mockRejectedValue(error);

      await expect(handler.deleteAccount('some-id')).rejects.toThrow(error);
      expect(mockAccounts.delete).toHaveBeenCalled();
    });
  });

  describe('getAccountAssets', () => {
    it.each([
      { tNetwork: 'bitcoin', caip19: Caip19Asset.Bitcoin },
      { tNetwork: 'testnet', caip19: Caip19Asset.Testnet },
      { tNetwork: 'testnet4', caip19: Caip19Asset.Testnet4 },
      { tNetwork: 'signet', caip19: Caip19Asset.Signet },
      { tNetwork: 'regtest', caip19: Caip19Asset.Regtest },
    ] as { tNetwork: Network; caip19: Caip19Asset }[])(
      'list assets for account: %s',
      async ({ tNetwork, caip19 }) => {
        mockAccounts.get.mockResolvedValue({
          network: tNetwork,
        } as unknown as BitcoinAccount);

        const result = await handler.getAccountAssets('some-id');

        expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
        expect(result).toStrictEqual([caip19]);
      },
    );

    it('propagates errors from get', async () => {
      const error = new Error();
      mockAccounts.get.mockRejectedValue(error);

      await expect(handler.getAccountAssets('some-id')).rejects.toThrow(error);
      expect(mockAccounts.get).toHaveBeenCalled();
    });
  });

  describe('getAccountTransactions', () => {
    const pagination = { limit: 10, next: null };

    const mockAmount = mock<Amount>({
      to_btc: () => 21,
    });
    const mockScriptPubkey = mock<ScriptBuf>({
      is_op_return: () => false,
    });
    const mockOutput = mock<TxOut>({
      value: mockAmount,
      script_pubkey: mockScriptPubkey,
    });
    const mockTxid = mock<Txid>({
      toString: () => 'txid',
    });
    const mockTx = mock<Transaction>({
      output: [mockOutput],
    });
    const mockWalletTx = mock<WalletTx>({
      tx: mockTx,
      txid: mockTxid,
      chain_position: {
        last_seen: BigInt(12345),
        anchor: {
          confirmation_time: BigInt(4567),
        },
      },
    });

    const expectedResult: KeyringTransaction = {
      account: mockAccount.id,
      chain: BtcScope.Mainnet,
      id: 'txid',
      type: 'send',
      status: 'confirmed',
      timestamp: 4567,
      events: [
        {
          status: 'unconfirmed',
          timestamp: 12345,
        },
        {
          status: 'confirmed',
          timestamp: 4567,
        },
      ],
      fees: [
        {
          type: 'priority',
          asset: {
            amount: '21',
            fungible: true,
            type: Caip19Asset.Bitcoin,
            unit: CurrencyUnit.Bitcoin,
          },
        },
      ],
      from: [],
      to: [
        {
          address: 'bc1qaddress...',
          asset: {
            amount: '21',
            fungible: true,
            type: Caip19Asset.Bitcoin,
            unit: CurrencyUnit.Bitcoin,
          },
        },
      ],
    };

    beforeEach(() => {
      mockAccount.calculateFee.mockReturnValue(mockAmount);
      mockAccounts.get.mockResolvedValue(mockAccount);
      mockAccount.sentAndReceived.mockReturnValue([mockAmount, mockAmount]);
      mockAccount.listTransactions.mockReturnValue([mockWalletTx]);
      (Address.from_script as jest.Mock).mockReturnValue(mockAddress);
    });

    it('lists transactions successfully: send', async () => {
      const id = 'some-id';

      const result = await handler.getAccountTransactions(id, pagination);

      expect(mockAccounts.get).toHaveBeenCalledWith(id);
      expect(result.data).toStrictEqual([expectedResult]);
    });

    it('discards own outputs from send transactions', async () => {
      const id = 'some-id';
      mockAccount.isMine.mockReturnValueOnce(true);

      const result = await handler.getAccountTransactions(id, pagination);

      expect(mockAccounts.get).toHaveBeenCalledWith(id);
      expect(result.data).toStrictEqual([{ ...expectedResult, to: [] }]);
    });

    it('lists transactions successfully: receive', async () => {
      const id = 'some-id';

      mockAccount.sentAndReceived.mockReturnValueOnce([
        { ...mockAmount, to_btc: () => 0 },
        mockAmount,
      ]);
      mockAccount.isMine.mockReturnValueOnce(true);

      const result = await handler.getAccountTransactions(id, pagination);

      expect(mockAccounts.get).toHaveBeenCalledWith(id);
      expect(result.data).toStrictEqual([
        { ...expectedResult, type: 'receive', fees: [] },
      ]);
    });

    it('respects limit and sets next to last txid', async () => {
      const id = 'some-id';
      const mockTransactions = Array.from({ length: 12 }, (_, index) => ({
        ...mockWalletTx,
        txid: mock<Txid>({
          toString: () => `txid-${index}`,
        }),
      }));

      mockAccount.listTransactions.mockReturnValue(mockTransactions);

      const result = await handler.getAccountTransactions(id, pagination);

      expect(result.data).toHaveLength(pagination.limit);
      expect(result.next).toBe('txid-9');
    });

    it('applies next parameter until last element', async () => {
      const id = 'some-id';
      const mockTransactions = Array.from({ length: 12 }, (_, index) => ({
        ...mockWalletTx,
        txid: mock<Txid>({
          toString: () => `txid-${index}`,
        }),
      }));

      mockAccount.listTransactions.mockReturnValue(mockTransactions);

      const result = await handler.getAccountTransactions(id, {
        ...pagination,
        next: 'txid-9',
      });

      expect(result.data).toHaveLength(
        mockTransactions.length - pagination.limit,
      );
      expect(result.next).toBeNull();
    });
  });

  describe('submitRequest', () => {
    it('calls KeyringRequestHandler', async () => {
      const mockRequest = mock<KeyringRequest>();
      const expectedResponse = mock<KeyringResponse>();
      mockKeyringRequest.route.mockResolvedValue(expectedResponse);

      const result = await handler.submitRequest(mockRequest);

      expect(mockKeyringRequest.route).toHaveBeenCalledWith(mockRequest);
      expect(result).toStrictEqual(expectedResponse);
    });
  });

  describe('resolveAccountAddress', () => {
    const mockKeyringAccount1 = mock<KeyringAccount>({
      id: 'account-1',
      address: 'test123',
      scopes: [BtcScope.Regtest],
    });
    const mockKeyringAccount2 = mock<KeyringAccount>({
      id: 'account-2',
      address: 'test456',
      scopes: [BtcScope.Regtest],
    });

    beforeEach(() => {
      mockAccounts.list.mockResolvedValue([mockAccount]);
    });

    it('resolves account address successfully', async () => {
      const request = {
        id: '1',
        jsonrpc: '2.0' as const,
        method: BtcMethod.SignPsbt,
        params: {
          account: { address: 'test123' },
          psbt: 'psbt',
        },
      };

      jest
        .spyOn(handler, 'getAccounts')
        .mockResolvedValueOnce([mockKeyringAccount1, mockKeyringAccount2]);

      const result = await handler.resolveAccountAddress(
        BtcScope.Regtest,
        request,
      );

      expect(handler.getAccounts).toHaveBeenCalled();
      expect(result).toStrictEqual({
        address: `${BtcScope.Regtest}:test123`,
      });
    });

    it('returns null when account address not found', async () => {
      const request = {
        id: '1',
        jsonrpc: '2.0' as const,
        method: BtcMethod.SignPsbt,
        params: {
          account: { address: 'notfound' },
          psbt: 'psbt',
        },
      };

      jest
        .spyOn(handler, 'getAccounts')
        .mockResolvedValue([mockKeyringAccount1, mockKeyringAccount2]);

      const result = await handler.resolveAccountAddress(
        BtcScope.Regtest,
        request,
      );

      expect(result).toBeNull();
    });

    it('returns null when no accounts match the scope', async () => {
      const request = {
        id: '1',
        jsonrpc: '2.0' as const,
        method: BtcMethod.SignPsbt,
        params: {
          account: { address: 'test123' },
          psbt: 'psbt',
        },
      };

      const accountWithDifferentScope = mock<KeyringAccount>({
        id: 'account-3',
        address: 'test123',
        scopes: [BtcScope.Mainnet],
      });

      jest
        .spyOn(handler, 'getAccounts')
        .mockResolvedValue([accountWithDifferentScope]);

      const result = await handler.resolveAccountAddress(
        BtcScope.Regtest,
        request,
      );

      expect(result).toBeNull();
    });

    it('returns null and tracks the error when scope validation fails', async () => {
      const request = {
        id: '1',
        jsonrpc: '2.0' as const,
        method: BtcMethod.SignPsbt,
        params: {
          account: { address: 'test123' },
          psbt: 'psbt',
        },
      };
      const error = new Error('Invalid scope');

      jest.mocked(assert).mockImplementationOnce(() => {
        throw error;
      });

      const result = await handler.resolveAccountAddress(
        'invalid-scope' as never,
        request,
      );

      expect(mockSnapClient.emitTrackingError).toHaveBeenCalledWith(error);
      expect(result).toBeNull();
    });

    it('returns null when request validation fails', async () => {
      const invalidRequest = {
        id: '1',
        jsonrpc: '2.0' as const,
        method: 'invalid',
        params: {},
      };

      jest
        .spyOn(handler, 'getAccounts')
        .mockResolvedValue([mockKeyringAccount1, mockKeyringAccount2]);

      // First assert (scope) passes, second assert (request struct) throws
      jest
        .mocked(assert)
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new Error('Invalid request');
        });

      const result = await handler.resolveAccountAddress(
        BtcScope.Regtest,
        invalidRequest,
      );

      expect(result).toBeNull();
    });
  });
});
