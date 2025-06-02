// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable camelcase */

import type { DescriptorPair } from '@metamask/bitcoindevkit';
import {
  ChangeSet,
  xpriv_to_descriptor,
  xpub_to_descriptor,
} from '@metamask/bitcoindevkit';
import type { SLIP10Node } from '@metamask/key-tree';
import { mock } from 'jest-mock-extended';

import type {
  AccountState,
  BitcoinAccount,
  Inscription,
  SnapClient,
  SnapState,
} from '../entities';
import { BdkAccountAdapter } from '../infra';
import { BdkAccountRepository } from './BdkAccountRepository';

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => {
  return {
    ChangeSet: {
      from_json: jest.fn(),
    },
    slip10_to_extended: jest.fn().mockReturnValue('mock-extended'),
    xpub_to_descriptor: jest.fn(),
    xpriv_to_descriptor: jest.fn(),
  };
});

jest.mock('../infra/BdkAccountAdapter', () => ({
  BdkAccountAdapter: {
    load: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('BdkAccountRepository', () => {
  const mockSnapClient = mock<SnapClient>();
  const mockWalletData = '{"mywallet":"data"}';
  const mockDerivationPath = ['m', "84'", "0'", "0'"];
  const mockSlip10Node = {
    masterFingerprint: 0xdeadbeef,
  } as unknown as SLIP10Node;
  const mockDescriptors = mock<DescriptorPair>({
    external: 'ext-desc',
    internal: 'int-desc',
  });
  const mockAccountState = mock<AccountState>({
    wallet: mockWalletData,
    derivationPath: mockDerivationPath,
  });
  const mockChangeSet = mock<ChangeSet>();
  const mockAccount = mock<BitcoinAccount>({
    id: 'some-id',
    derivationPath: mockDerivationPath,
    network: 'bitcoin',
    addressType: 'p2wpkh',
  });

  const repo = new BdkAccountRepository(mockSnapClient);

  beforeEach(() => {
    (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);
    (BdkAccountAdapter.create as jest.Mock).mockReturnValue(mockAccount);
    (ChangeSet.from_json as jest.Mock).mockReturnValue(mockChangeSet);
    mockSnapClient.getPrivateEntropy.mockResolvedValue(mockSlip10Node);
    mockSnapClient.getPublicEntropy.mockResolvedValue(mockSlip10Node);
    (xpriv_to_descriptor as jest.Mock).mockReturnValue(mockDescriptors);
    (xpub_to_descriptor as jest.Mock).mockReturnValue(mockDescriptors);
    (mockAccount.takeStaged as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockChangeSet);
    (mockChangeSet.to_json as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockWalletData);
  });

  describe('get', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      const result = await repo.get('non-existent-id');

      expect(result).toBeNull();
    });

    it('returns loaded account if found', async () => {
      mockSnapClient.getState.mockResolvedValue(mockAccountState);

      const result = await repo.get('some-id');

      expect(mockSnapClient.getState).toHaveBeenCalledWith('accounts.some-id');
      expect(ChangeSet.from_json).toHaveBeenCalledWith(mockWalletData);
      expect(BdkAccountAdapter.load).toHaveBeenCalledWith(
        mockAccount.id,
        mockDerivationPath,
        mockChangeSet,
      );
      expect(result).toBe(mockAccount);
    });
  });

  describe('getAll', () => {
    it('returns empty array if no accounts found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      const result = await repo.getAll();

      expect(result).toStrictEqual([]);
    });

    it('returns all accounts', async () => {
      const id1 = 'some-id-1';
      const id2 = 'some-id-2';
      const state = {
        [id1]: { ...mockAccountState, id: id1 },
        [id2]: { ...mockAccountState, id: id2 },
      };
      const mockAccount1 = { ...mockAccount, id: id1 };
      const mockAccount2 = { ...mockAccount, id: id2 };

      mockSnapClient.getState.mockResolvedValue(state);
      (BdkAccountAdapter.load as jest.Mock)
        .mockReturnValueOnce(mockAccount1)
        .mockReturnValueOnce(mockAccount2);

      const result = await repo.getAll();

      expect(mockSnapClient.getState).toHaveBeenCalledWith('accounts');
      expect(BdkAccountAdapter.load).toHaveBeenCalledTimes(2);
      expect(result).toStrictEqual([mockAccount1, mockAccount2]);
    });
  });

  describe('getByDerivationPath', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      const result = await repo.getByDerivationPath(mockDerivationPath);

      expect(result).toBeNull();
    });

    it('returns account if derivation path exists', async () => {
      mockSnapClient.getState.mockResolvedValue('some-id');

      const result = await repo.getByDerivationPath(mockDerivationPath);

      expect(mockSnapClient.getState).toHaveBeenCalledWith(
        "derivationPaths.m/84'/0'/0'",
      );
      expect(mockSnapClient.getState).toHaveBeenCalledWith('accounts.some-id');
      expect(result).toBe(mockAccount);
    });
  });

  describe('getWithSigner', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      const result = await repo.getWithSigner('some-id');

      expect(result).toBeNull();
    });

    it('returns account with signer if account exists', async () => {
      mockSnapClient.getState.mockResolvedValue(mockAccountState);

      const result = await repo.getWithSigner('some-id');

      expect(mockSnapClient.getPrivateEntropy).toHaveBeenCalledWith(
        mockDerivationPath,
      );
      expect(BdkAccountAdapter.load).toHaveBeenCalledTimes(2);
      expect(BdkAccountAdapter.load).toHaveBeenLastCalledWith(
        'some-id',
        mockDerivationPath,
        mockChangeSet,
        mockDescriptors,
      );
      expect(result).toBe(mockAccount);
    });
  });

  describe('create', () => {
    it('creates a new account with xpub', async () => {
      const result = await repo.create(mockDerivationPath, 'bitcoin', 'p2wpkh');

      expect(BdkAccountAdapter.create).toHaveBeenCalledWith(
        'mock-uuid',
        mockDerivationPath,
        mockDescriptors,
        'bitcoin',
      );
      expect(result).toBe(mockAccount);
    });
  });

  describe('insert', () => {
    it('throws an error if no wallet data', async () => {
      await expect(
        repo.insert({
          ...mockAccount,
          takeStaged: jest.fn().mockReturnValue(undefined),
        }),
      ).rejects.toThrow(
        'Missing changeset data for account "some-id" for insertion.',
      );
    });

    it('inserts an account', async () => {
      await repo.insert(mockAccount);

      expect(mockSnapClient.setState).toHaveBeenNthCalledWith(
        1,
        "derivationPaths.m/84'/0'/0'",
        mockAccount.id,
      );
      expect(mockSnapClient.setState).toHaveBeenLastCalledWith(
        'accounts.some-id',
        {
          wallet: mockWalletData,
          inscriptions: [],
          derivationPath: mockDerivationPath,
        },
      );
    });
  });

  describe('update', () => {
    it('does nothing if no wallet data', async () => {
      await repo.update({
        ...mockAccount,
        takeStaged: jest.fn().mockReturnValue(undefined),
      });

      expect(mockSnapClient.setState).not.toHaveBeenCalled();
    });

    it('throws an error if account not found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      await expect(repo.update(mockAccount)).rejects.toThrow(
        'Inconsistent state: account "some-id" not found for update',
      );
    });

    it('updates the account and inscriptions', async () => {
      const mockInscription = mock<Inscription>();

      mockSnapClient.getState.mockResolvedValue(mockWalletData);

      await repo.update(mockAccount, [mockInscription]);

      expect(mockChangeSet.merge).toHaveBeenCalled();
      expect(mockSnapClient.getState).toHaveBeenCalledWith(
        'accounts.some-id.wallet',
      );
      expect(mockSnapClient.setState).toHaveBeenNthCalledWith(
        1,
        'accounts.some-id.wallet',
        mockWalletData,
      );
      expect(mockSnapClient.setState).toHaveBeenLastCalledWith(
        'accounts.some-id.inscriptions',
        [mockInscription],
      );
    });
  });

  describe('delete', () => {
    it('does nothing if account not found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      await repo.delete('non-existent-id');

      expect(mockSnapClient.setState).not.toHaveBeenCalled();
    });

    it('removes wallet data from store', async () => {
      const mockState: SnapState = {
        accounts: {
          'some-id-1': { ...mockAccountState, derivationPath: ["m/84'/0'/0'"] },
          'some-id-2': { ...mockAccountState, derivationPath: ["m/86'/0'/0'"] },
        },
        derivationPaths: {
          "m/84'/0'/0'": 'some-id-1',
          "m/86'/0'/0'": 'some-id-2',
        },
      };
      const expectedState = {
        accounts: {
          'some-id-2': { ...mockAccountState, derivationPath: ["m/86'/0'/0'"] },
        },
        derivationPaths: {
          "m/86'/0'/0'": 'some-id-2',
        },
      };

      mockSnapClient.getState.mockResolvedValue(mockState);

      await repo.delete('some-id-1');

      expect(mockSnapClient.setState).toHaveBeenCalledWith('', expectedState);
    });
  });

  describe('getFrozenUTXOs', () => {
    it('returns empty array if inscriptions is not found', async () => {
      mockSnapClient.getState.mockResolvedValue(null);

      const result = await repo.getFrozenUTXOs('non-existent-id');
      expect(result).toStrictEqual([]);
    });

    it('returns empty array if inscriptions is empty', async () => {
      mockSnapClient.getState.mockResolvedValue([]);

      const result = await repo.getFrozenUTXOs('some-id');
      expect(result).toStrictEqual([]);
    });

    it('returns the list of frozen UTXO outpoints', async () => {
      const mockInscriptions = [
        { location: 'txid1:vout:offset' },
        { location: 'txid2:vout:offset' },
      ] as Inscription[];

      mockSnapClient.getState.mockResolvedValue(mockInscriptions);

      const result = await repo.getFrozenUTXOs('some-id');

      expect(mockSnapClient.getState).toHaveBeenCalledWith(
        'accounts.some-id.inscriptions',
      );
      expect(result).toStrictEqual(['txid1:vout', 'txid2:vout']);
    });
  });
});
