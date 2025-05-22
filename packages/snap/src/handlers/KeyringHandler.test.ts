import type {
  AddressInfo,
  Amount,
  Transaction,
  Txid,
  TxOut,
  Network,
  WalletTx,
  AddressType,
} from '@metamask/bitcoindevkit';
import { Address } from '@metamask/bitcoindevkit';
import type {
  DiscoveredAccount,
  Transaction as KeyringTransaction,
} from '@metamask/keyring-api';
import { BtcMethod, BtcScope } from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { SnapClient, BitcoinAccount } from '../entities';
import { CurrencyUnit, Purpose } from '../entities';
import { KeyringHandler, CreateAccountRequest } from './KeyringHandler';
import {
  scopeToNetwork,
  caipToAddressType,
  Caip2AddressType,
  Caip19Asset,
} from './mappings';
import { mapToDiscoveredAccount } from './tx-mapping';
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
  const mockAccounts = mock<AccountUseCases>();
  const mockSnapClient = mock<SnapClient>();
  const mockAddress = mock<Address>({
    toString: () => 'bc1qaddress...',
  });
  // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
  /* eslint-disable @typescript-eslint/naming-convention */
  const mockAccount = mock<BitcoinAccount>({
    id: 'some-id',
    addressType: 'p2wpkh',
    balance: { trusted_spendable: { to_btc: () => 1 } },
    network: 'bitcoin',
  });

  const handler = new KeyringHandler(mockAccounts, mockSnapClient);

  beforeEach(() => {
    mockAccounts.create.mockResolvedValue(mockAccount);
    mockAccount.peekAddress.mockReturnValue(
      mock<AddressInfo>({
        address: mockAddress,
      }),
    );
  });

  describe('createAccount', () => {
    const entropySource = 'some-source';
    const index = 1;
    const correlationId = 'correlation-id';

    it('respects provided params', async () => {
      const options = {
        scope: BtcScope.Signet,
        entropySource,
        index,
        addressType: Caip2AddressType.P2pkh,
        metamask: {
          correlationId,
        },
      };
      const expectedCreateParams: CreateAccountParams = {
        network: scopeToNetwork[BtcScope.Signet],
        entropySource,
        index,
        addressType: caipToAddressType[Caip2AddressType.P2pkh],
      };

      await handler.createAccount(options);

      expect(assert).toHaveBeenCalledWith(options, CreateAccountRequest);
      expect(mockAccounts.create).toHaveBeenCalledWith(expectedCreateParams);
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalledWith(
        mockAccount,
        correlationId,
      );
      expect(mockAccounts.fullScan).not.toHaveBeenCalled();
    });

    it('extracts index from derivationPath', async () => {
      const options = {
        scope: BtcScope.Signet,
        derivationPath: "m/44'/0'/5'/*/*", // change and address indexes can be anything
      };
      const expectedCreateParams: CreateAccountParams = {
        network: 'signet',
        index: 5,
        addressType: 'p2pkh',
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

    it.each([
      { purpose: Purpose.Legacy, addressType: 'p2pkh' },
      { purpose: Purpose.Segwit, addressType: 'p2sh' },
      { purpose: Purpose.NativeSegwit, addressType: 'p2wpkh' },
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

    it('performs a full scan when synchronize option is true', async () => {
      const options = {
        scope: BtcScope.Signet,
        synchronize: true,
      };
      await handler.createAccount(options);

      expect(mockAccounts.create).toHaveBeenCalled();
      expect(mockAccounts.fullScan).toHaveBeenCalledWith(mockAccount);
    });

    it('propagates errors from createAccount', async () => {
      const error = new Error('createAccount error');
      mockAccounts.create.mockRejectedValue(error);

      await expect(
        handler.createAccount({ scopes: [BtcScope.Mainnet] }),
      ).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
    });

    it('propagates errors from fullScan', async () => {
      const error = new Error('fullScan error');
      mockAccounts.fullScan.mockRejectedValue(error);

      await expect(
        handler.createAccount({
          scopes: [BtcScope.Mainnet],
          synchronize: true,
        }),
      ).rejects.toThrow(error);
      expect(mockAccounts.fullScan).toHaveBeenCalled();
    });

    it('propagates errors from emitAccountCreatedEvent', async () => {
      const error = new Error('emitAccountCreatedEvent error');
      mockSnapClient.emitAccountCreatedEvent.mockRejectedValue(error);

      await expect(
        handler.createAccount({ scopes: [BtcScope.Mainnet] }),
      ).rejects.toThrow(error);
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
    });
  });

  describe('discoverAccounts', () => {
    const entropySource = 'some-source';
    const groupIndex = 0;
    const scopes = Object.values(BtcScope);

    it('creates, scans and returns accounts for every scope/addressType combination', async () => {
      const addressTypes = Object.values(Caip2AddressType);
      const totalCombinations = scopes.length * addressTypes.length;

      const expected: DiscoveredAccount[] = [];
      scopes.forEach((scope) => {
        addressTypes.forEach((addrType) => {
          const acc = mock<BitcoinAccount>({
            addressType: caipToAddressType[addrType],
            network: scopeToNetwork[scope],
            listTransactions: jest.fn().mockReturnValue([{}]), // has history
          });

          expected.push(mapToDiscoveredAccount(acc, groupIndex));
          mockAccounts.create.mockResolvedValueOnce(acc);
        });
      });

      const discovered = await handler.discoverAccounts(
        scopes,
        entropySource,
        groupIndex,
      );

      expect(mockAccounts.create).toHaveBeenCalledTimes(totalCombinations);
      expect(mockAccounts.fullScan).toHaveBeenCalledTimes(totalCombinations);

      // validate each individual create() call arguments
      scopes.forEach((scope, sIdx) => {
        addressTypes.forEach((addrType, aIdx) => {
          const callIdx = sIdx * addressTypes.length + aIdx;
          expect(mockAccounts.create).toHaveBeenNthCalledWith(callIdx + 1, {
            network: scopeToNetwork[scope],
            entropySource,
            index: groupIndex,
            addressType: caipToAddressType[addrType],
            synchronize: true,
          });
        });
      });

      // Order is not guaranteed, so compare as sets
      expect(discovered).toHaveLength(expected.length);
      expect(discovered).toStrictEqual(expect.arrayContaining(expected));
    });

    it('filters out accounts that have no transaction history', async () => {
      const addressTypes = Object.values(Caip2AddressType);
      const totalCombinations = scopes.length * addressTypes.length;

      for (let i = 0; i < totalCombinations; i += 1) {
        const acc = mock<BitcoinAccount>({
          listTransactions: jest.fn().mockReturnValue([]), // no history
        });

        mockAccounts.create.mockResolvedValueOnce(acc);
      }

      const discovered = await handler.discoverAccounts(
        scopes,
        entropySource,
        groupIndex,
      );

      expect(discovered).toHaveLength(0);
    });

    it('propagates errors from create', async () => {
      const error = new Error('create error');
      mockAccounts.create.mockRejectedValue(error);

      await expect(
        handler.discoverAccounts(scopes, entropySource, groupIndex),
      ).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
    });

    it('propagates errors from fullScan()', async () => {
      const error = new Error('fullScan error');
      mockAccounts.create.mockResolvedValue(mock<BitcoinAccount>());
      mockAccounts.fullScan.mockRejectedValue(error);

      await expect(
        handler.discoverAccounts(scopes, entropySource, groupIndex),
      ).rejects.toThrow(error);
      expect(mockAccounts.fullScan).toHaveBeenCalled();
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
        type: Caip2AddressType.P2wpkh,
        scopes: [BtcScope.Mainnet],
        address: 'bc1qaddress...',
        options: {},
        methods: [BtcMethod.SendBitcoin],
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
          type: Caip2AddressType.P2wpkh,
          scopes: [BtcScope.Mainnet],
          address: 'bc1qaddress...',
          options: {},
          methods: [BtcMethod.SendBitcoin],
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
    const mockOutput = mock<TxOut>({
      value: mockAmount,
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
});
