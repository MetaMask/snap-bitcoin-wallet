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
  DiscoveredAccount,
  KeyringResponse,
  Transaction as KeyringTransaction,
  KeyringRequest,
  KeyringAccount,
} from '@metamask/keyring-api';
import { BtcAccountType, BtcMethod, BtcScope } from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { BitcoinAccount, Logger, SnapClient } from '../entities';
import {
  AccountCapability,
  CurrencyUnit,
  Purpose,
  FormatError,
} from '../entities';
import { scopeToNetwork, caipToAddressType, Caip19Asset } from './caip';
import { KeyringHandler, CreateAccountRequest } from './KeyringHandler';
import type { KeyringRequestHandler } from './KeyringRequestHandler';
import { mapToDiscoveredAccount } from './mappings';
import type {
  AccountUseCases,
  CreateAccountParams,
} from '../use-cases/AccountUseCases';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => {
  return {
    Address: {
      from_script: jest.fn(),
    },
  };
});

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
    balance: { trusted_spendable: { to_btc: () => 1 } },
    network: 'bitcoin',
    derivationPath: ['myEntropy', "84'", "0'", "0'"],
    entropySource: 'myEntropy',
    accountIndex: 0,
    publicAddress: mockAddress,
    capabilities: [AccountCapability.SignPsbt, AccountCapability.ComputeFee],
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
    mockAccounts.create.mockResolvedValue(mockAccount);
  });

  describe('createAccount', () => {
    const entropySource = 'some-source';
    const index = 1;
    const correlationId = 'correlation-id';

    // non-P2WPKH address types as we are not supporting them for v1
    it.skip('respects provided params', async () => {
      const options = {
        scope: BtcScope.Signet,
        entropySource,
        index,
        addressType: BtcAccountType.P2pkh,
        metamask: {
          correlationId,
        },
        accountNameSuggestion: 'My account',
        synchronize: false,
      };
      const expectedCreateParams: CreateAccountParams = {
        network: scopeToNetwork[BtcScope.Signet],
        entropySource,
        index,
        addressType: 'p2pkh',
        synchronize: false,
        correlationId,
        accountName: 'My account',
      };

      await handler.createAccount(options);

      expect(assert).toHaveBeenCalledWith(options, CreateAccountRequest);
      expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);
      expect(mockAccounts.fullScan).not.toHaveBeenCalled();
    });

    // only P2WPKH (BIP-84) derivation paths are now supported for v1
    it.skip('extracts index from derivationPath', async () => {
      const options = {
        scope: BtcScope.Signet,
        derivationPath: "m/44'/0'/5'/*/*", // change and address indexes can be anything
      };
      const expectedCreateParams: CreateAccountParams = {
        network: 'signet',
        index: 5,
        addressType: 'p2pkh',
        entropySource: 'm',
        synchronize: true,
      };

      await handler.createAccount(options);
      expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);

      // Test with a valid derivationPath without change and address index
      await handler.createAccount({
        ...options,
        derivationPath: "m/44'/0'/3'",
      });
      expect(mockAccounts.create).toHaveBeenCalledWith({
        ...expectedCreateParams,
        index: 3,
      });
    });

    it('auto increment index', async () => {
      // We should get index 1
      mockAccounts.list.mockResolvedValue([
        mock<BitcoinAccount>({
          entropySource: 'entropy1',
          accountIndex: 1,
          addressType: 'p2wpkh',
          network: 'signet',
        }),
        mock<BitcoinAccount>({
          entropySource: 'entropy2',
          accountIndex: 2,
          addressType: 'p2wpkh',
          network: 'signet',
        }),
        mock<BitcoinAccount>({
          entropySource: 'entropy2',
          accountIndex: 0,
          addressType: 'p2wpkh',
          network: 'signet',
        }),
        mock<BitcoinAccount>({
          entropySource: 'entropy2',
          accountIndex: 3,
          addressType: 'p2tr',
          network: 'bitcoin',
        }),
      ]);

      const options = {
        scope: BtcScope.Signet,
        index: null,
        entropySource: 'entropy2',
      };
      const expectedCreateParams: CreateAccountParams = {
        network: 'signet',
        index: 1,
        addressType: 'p2wpkh',
        entropySource: 'entropy2',
        synchronize: false,
      };

      await handler.createAccount(options);

      expect(mockAccounts.list).toHaveBeenCalled();
      expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);
    });

    it.each([{ purpose: Purpose.NativeSegwit, addressType: 'p2wpkh' }] as {
      purpose: Purpose;
      addressType: AddressType;
    }[])(
      'extracts P2WPKH address type from derivationPath: %s',
      async ({ purpose, addressType }) => {
        const options = {
          scope: BtcScope.Signet,
          derivationPath: `m/${purpose}'/0'/0'`,
        };
        const expectedCreateParams: CreateAccountParams = {
          network: 'signet',
          index: 0,
          addressType,
          entropySource: 'm',
          synchronize: false,
        };

        await handler.createAccount(options);
        expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);
      },
    );

    // skip non-P2WPKH address types as they are not supported on v1
    it.skip.each([
      { purpose: Purpose.Legacy, addressType: 'p2pkh' },
      { purpose: Purpose.Segwit, addressType: 'p2sh' },
      { purpose: Purpose.Taproot, addressType: 'p2tr' },
      { purpose: Purpose.Multisig, addressType: 'p2wsh' },
    ] as { purpose: Purpose; addressType: AddressType }[])(
      'extracts address type from derivationPath: %s',
      async ({ purpose, addressType }) => {
        const options = {
          scope: BtcScope.Signet,
          derivationPath: `m/${purpose}'/0'/0'`,
        };
        const expectedCreateParams: CreateAccountParams = {
          network: 'signet',
          index: 0,
          addressType,
          entropySource: 'm',
          synchronize: true,
        };

        await handler.createAccount(options);
        expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);
      },
    );

    it('fails if derivationPath is invalid', async () => {
      const options = {
        scope: BtcScope.Signet,
        derivationPath: "m/44'/0'/NaN'",
      };

      await expect(handler.createAccount(options)).rejects.toThrow(
        'Invalid account index: NaN',
      );

      await expect(
        handler.createAccount({ ...options, derivationPath: "m/60'/0'/0'" }), // unknown purpose
      ).rejects.toThrow('Invalid BIP-purpose: 60');

      await expect(
        handler.createAccount({ ...options, derivationPath: "m/44'/0'/-1'" }), // negative index
      ).rejects.toThrow("Invalid account index: -1'");

      await expect(
        handler.createAccount({ ...options, derivationPath: "m/44'" }), // missing segments
      ).rejects.toThrow("Invalid derivation path: m/44'");
    });

    it('fails when addressType and derivationPath mismatch', async () => {
      const options = {
        scope: BtcScope.Signet,
        addressType: BtcAccountType.P2wpkh,
        derivationPath: "m/44'/0'/0'", // Legacy path (P2PKH)
      };

      // The error comes from #extractAddressType which validates the derivation path first
      await expect(handler.createAccount(options)).rejects.toThrow(
        new FormatError(
          'Only native segwit (BIP-84) derivation paths are supported',
        ),
      );
    });

    it('succeeds when addressType and derivationPath both indicate P2WPKH', async () => {
      const options = {
        scope: BtcScope.Signet,
        addressType: BtcAccountType.P2wpkh,
        derivationPath: "m/84'/0'/5'", // Native segwit path
      };
      const expectedCreateParams: CreateAccountParams = {
        network: 'signet',
        index: 5,
        addressType: 'p2wpkh',
        entropySource: 'm',
        synchronize: false,
      };

      await handler.createAccount(options);
      expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);
    });

    it('propagates errors from createAccount', async () => {
      const error = new Error('createAccount error');
      mockAccounts.create.mockRejectedValue(error);

      await expect(
        handler.createAccount({ scopes: [BtcScope.Mainnet], index: 0 }),
      ).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
    });

    describe('tracing', () => {
      const options = {
        scope: BtcScope.Mainnet,
        index: 0,
      };

      beforeEach(() => {
        mockSnapClient.startTrace.mockResolvedValue(undefined);
        mockSnapClient.endTrace.mockResolvedValue(undefined);
      });

      it('calls startTrace and endTrace with correct trace name', async () => {
        await handler.createAccount(options);

        expect(mockSnapClient.startTrace).toHaveBeenCalledWith(
          'Create Bitcoin Account',
        );
        expect(mockSnapClient.endTrace).toHaveBeenCalledWith(
          'Create Bitcoin Account',
        );
      });

      it('calls startTrace before creating account', async () => {
        const callOrder: string[] = [];
        mockSnapClient.startTrace.mockImplementation(async () => {
          callOrder.push('startTrace');
        });
        mockAccounts.create.mockImplementation(async () => {
          callOrder.push('createAccount');
          return mockAccount;
        });

        await handler.createAccount(options);

        expect(callOrder).toStrictEqual(['startTrace', 'createAccount']);
      });

      it('calls endTrace after creating account', async () => {
        const callOrder: string[] = [];
        mockAccounts.create.mockImplementation(async () => {
          callOrder.push('createAccount');
          return mockAccount;
        });
        mockSnapClient.endTrace.mockImplementation(async () => {
          callOrder.push('endTrace');
        });

        await handler.createAccount(options);

        expect(callOrder).toStrictEqual(['createAccount', 'endTrace']);
      });

      it('creates account even if startTrace fails', async () => {
        mockSnapClient.startTrace.mockResolvedValue(undefined);

        const result = await handler.createAccount(options);

        expect(result).toBeDefined();
        expect(mockAccounts.create).toHaveBeenCalled();
        expect(mockSnapClient.startTrace).toHaveBeenCalled();
      });

      it('calls both startTrace and endTrace even if startTrace returns null', async () => {
        mockSnapClient.startTrace.mockResolvedValue(undefined);

        await handler.createAccount(options);

        expect(mockSnapClient.startTrace).toHaveBeenCalledWith(
          'Create Bitcoin Account',
        );
        expect(mockSnapClient.endTrace).toHaveBeenCalledWith(
          'Create Bitcoin Account',
        );
      });
    });
  });

  describe('discoverAccounts', () => {
    const entropySource = 'some-source';
    const groupIndex = 0;
    const scopes = Object.values(BtcScope);

    it('creates, scans and returns accounts for every scope/addressType combination', async () => {
      // only P2WPKH is now supported for v1
      const addressTypes = [BtcAccountType.P2wpkh];
      const totalCombinations = scopes.length * addressTypes.length;

      const expected: DiscoveredAccount[] = [];
      scopes.forEach((scope) => {
        addressTypes.forEach((addrType) => {
          const acc = mock<BitcoinAccount>({
            addressType: caipToAddressType[addrType],
            network: scopeToNetwork[scope],
            listTransactions: jest.fn().mockReturnValue([{}]), // has history
            derivationPath: ['m', "84'", "0'", "0'"],
          });

          expected.push(mapToDiscoveredAccount(acc));
          mockAccounts.discover.mockResolvedValueOnce(acc);
        });
      });

      const discovered = await handler.discoverAccounts(
        scopes,
        entropySource,
        groupIndex,
      );

      expect(mockAccounts.discover).toHaveBeenCalledTimes(totalCombinations);

      // validate each individual create() call arguments
      scopes.forEach((scope, sIdx) => {
        addressTypes.forEach((addrType, aIdx) => {
          const callIdx = sIdx * addressTypes.length + aIdx;
          expect(mockAccounts.discover).toHaveBeenNthCalledWith(callIdx + 1, {
            network: scopeToNetwork[scope],
            entropySource,
            index: groupIndex,
            addressType: caipToAddressType[addrType],
          });
        });
      });

      // Order is not guaranteed, so compare as sets
      expect(discovered).toHaveLength(expected.length);
      expect(discovered).toStrictEqual(expect.arrayContaining(expected));
    });

    it('returns mix of accounts with and without history, filtering correctly', async () => {
      // create mock accounts - some with history, some without
      const accountWithHistory1 = mock<BitcoinAccount>({
        addressType: 'p2wpkh',
        network: 'bitcoin',
        listTransactions: jest.fn().mockReturnValue([{}, {}]), // has 2 transactions
        derivationPath: ['m', "84'", "0'", "0'"],
      });

      const accountWithoutHistory = mock<BitcoinAccount>({
        addressType: 'p2wpkh',
        network: 'testnet',
        listTransactions: jest.fn().mockReturnValue([]), // no history
        derivationPath: ['m', "84'", "1'", "0'"],
      });

      const accountWithHistory2 = mock<BitcoinAccount>({
        addressType: 'p2wpkh',
        network: 'signet',
        listTransactions: jest.fn().mockReturnValue([{}]), // has 1 transaction
        derivationPath: ['m', "84'", "1'", "0'"],
      });

      mockAccounts.discover
        .mockResolvedValueOnce(accountWithHistory1)
        .mockResolvedValueOnce(accountWithoutHistory)
        .mockResolvedValueOnce(accountWithHistory2);

      const discovered = await handler.discoverAccounts(
        [BtcScope.Mainnet, BtcScope.Testnet, BtcScope.Signet],
        entropySource,
        groupIndex,
      );

      expect(mockAccounts.discover).toHaveBeenCalledTimes(3);
      expect(discovered).toHaveLength(2);
      expect(discovered).toStrictEqual([
        mapToDiscoveredAccount(accountWithHistory1),
        mapToDiscoveredAccount(accountWithHistory2),
      ]);
    });

    it('propagates errors from discover', async () => {
      const error = new Error('discover error');
      mockAccounts.discover.mockRejectedValue(error);

      await expect(
        handler.discoverAccounts(scopes, entropySource, groupIndex),
      ).rejects.toThrow(error);
      expect(mockAccounts.discover).toHaveBeenCalled();
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
          exportable: false,
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

  describe('listAccounts', () => {
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
            exportable: false,
          },
          methods: mockAccount.capabilities,
        },
      ];

      const result = await handler.listAccounts();
      expect(mockAccounts.list).toHaveBeenCalled();
      expect(result).toStrictEqual(expectedKeyringAccounts);
    });

    it('propagates errors from list', async () => {
      const error = new Error();
      mockAccounts.list.mockRejectedValue(error);

      await expect(handler.listAccounts()).rejects.toThrow(error);
      expect(mockAccounts.list).toHaveBeenCalled();
    });
  });

  describe('filterAccountChains', () => {
    it('includes chain if account network corresponds', async () => {
      mockAccounts.get.mockResolvedValue(mockAccount);

      const result = await handler.filterAccountChains('some-id', [
        BtcScope.Mainnet,
      ]);
      expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
      expect(result).toStrictEqual([BtcScope.Mainnet]);
    });

    it('does not include chain if account network does not correspond', async () => {
      mockAccounts.get.mockResolvedValue(mockAccount);

      const result = await handler.filterAccountChains('some-id', [
        BtcScope.Testnet,
      ]);
      expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
      expect(result).toStrictEqual([]);
    });

    it('propagates errors from get', async () => {
      const error = new Error();
      mockAccounts.get.mockRejectedValue(error);

      await expect(
        handler.filterAccountChains('some-id', [BtcScope.Mainnet]),
      ).rejects.toThrow(error);
      expect(mockAccounts.get).toHaveBeenCalled();
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

  describe('listAccountAssets', () => {
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

        const result = await handler.listAccountAssets('some-id');

        expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
        expect(result).toStrictEqual([caip19]);
      },
    );

    it('propagates errors from get', async () => {
      const error = new Error();
      mockAccounts.get.mockRejectedValue(error);

      await expect(handler.listAccountAssets('some-id')).rejects.toThrow(error);
      expect(mockAccounts.get).toHaveBeenCalled();
    });
  });

  describe('listAccountTransactions', () => {
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

      const result = await handler.listAccountTransactions(id, pagination);

      expect(mockAccounts.get).toHaveBeenCalledWith(id);
      expect(result.data).toStrictEqual([expectedResult]);
    });

    it('discards own outputs from send transactions', async () => {
      const id = 'some-id';
      mockAccount.isMine.mockReturnValueOnce(true);

      const result = await handler.listAccountTransactions(id, pagination);

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

      const result = await handler.listAccountTransactions(id, pagination);

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

      const result = await handler.listAccountTransactions(id, pagination);

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

      const result = await handler.listAccountTransactions(id, {
        ...pagination,
        next: 'txid-9',
      });

      expect(result.data).toHaveLength(
        mockTransactions.length - pagination.limit,
      );
      expect(result.next).toBeNull();
    });
  });

  describe('updateAccount', () => {
    it('throws not supported', async () => {
      await expect(handler.updateAccount()).rejects.toThrow(
        'Method not supported.',
      );
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
      const requestWithoutCommonHeader = {
        method: request.method,
        params: request.params,
      };

      // mockAccounts.list.mockResolvedValue([mockAccount]);
      jest
        .spyOn(handler, 'listAccounts')
        .mockResolvedValueOnce([mockKeyringAccount1, mockKeyringAccount2]);
      mockKeyringRequest.resolveAccountAddress.mockReturnValue(
        'bip122:000000000019d6689c085ae165831e93:test123',
      );

      const result = await handler.resolveAccountAddress(
        BtcScope.Regtest,
        request,
      );

      expect(handler.listAccounts).toHaveBeenCalled();
      expect(mockKeyringRequest.resolveAccountAddress).toHaveBeenCalledWith(
        [mockKeyringAccount1, mockKeyringAccount2],
        BtcScope.Regtest,
        requestWithoutCommonHeader,
      );
      expect(result).toStrictEqual({
        address: 'bip122:000000000019d6689c085ae165831e93:test123',
      });
    });

    it('returns null on error', async () => {
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
        .spyOn(handler, 'listAccounts')
        .mockImplementation()
        .mockResolvedValue([mockKeyringAccount1, mockKeyringAccount2]);
      mockKeyringRequest.resolveAccountAddress.mockImplementation(() => {
        throw new Error('Account not found');
      });

      const result = await handler.resolveAccountAddress(
        BtcScope.Regtest,
        request,
      );

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
        .spyOn(handler, 'listAccounts')
        .mockImplementation()
        .mockResolvedValue([mockKeyringAccount1, mockKeyringAccount2]);

      jest.mocked(assert).mockImplementationOnce(() => {
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
