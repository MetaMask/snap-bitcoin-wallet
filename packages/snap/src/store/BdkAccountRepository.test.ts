import type { SLIP10Node } from '@metamask/key-tree';
import { ChangeSet } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import type { SnapClient } from '../entities/snap';
import { BdkAccountAdapter } from '../infra';
import { BdkAccountRepository } from './BdkAccountRepository';

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('bitcoindevkit', () => {
  return {
    ChangeSet: {
      from_json: jest.fn(),
    },
    slip10_to_extended: jest.fn().mockReturnValue('mock-extended'),
    xpub_to_descriptor: jest
      .fn()
      .mockReturnValue({ external: 'ext-desc', internal: 'int-desc' }),
  };
});

jest.mock('../infra/BdkAccountAdapter', () => ({
  BdkAccountAdapter: {
    load: jest.fn(),
    create: jest.fn().mockReturnValue({
      takeStaged: () => ({ to_json: () => '{"mywallet": "mywalletdata"}' }),
    }),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('BdkAccountRepository', () => {
  let repo: BdkAccountRepository;
  const mockSnapClient = mock<SnapClient>();

  beforeEach(() => {
    repo = new BdkAccountRepository(mockSnapClient);
  });

  describe('get', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });

      const result = await repo.get('non-existent-id');
      expect(result).toBeNull();
      expect(BdkAccountAdapter.load).not.toHaveBeenCalled();
    });

    it('returns loaded account if found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: {},
          wallets: { 'some-id': '{"mywallet": "data"}' },
        },
      });

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);
      (ChangeSet.from_json as jest.Mock).mockReturnValue({ mywallet: 'data' });

      const result = await repo.get('some-id');
      expect(result).toBe(mockAccount);
      expect(ChangeSet.from_json).toHaveBeenCalledWith('{"mywallet": "data"}');
      expect(BdkAccountAdapter.load).toHaveBeenCalledWith('some-id', {
        mywallet: 'data',
      });
    });
  });

  describe('getByDerivationPath', () => {
    it('returns null if derivation path not mapped', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });

      const result = await repo.getByDerivationPath(['m', "84'", "0'", "0'"]);
      expect(result).toBeNull();
    });

    it('returns account if derivation path exists', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'some-id' },
          wallets: { 'some-id': '{}' },
        },
      });

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);

      const result = await repo.getByDerivationPath(derivationPath);
      expect(result).toBe(mockAccount);
    });
  });

  describe('insert', () => {
    it('inserts a new account with xpub', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });
      mockSnapClient.getPublicEntropy.mockResolvedValue({
        masterFingerprint: 0xdeadbeef,
      } as unknown as SLIP10Node);

      const mockAccount = {
        takeStaged: () => ({ to_json: () => '{}' }),
      } as unknown as BitcoinAccount;
      (BdkAccountAdapter.create as jest.Mock).mockReturnValue(mockAccount);

      await repo.insert(derivationPath, 'bitcoin', 'p2wpkh');

      expect(mockSnapClient.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'mock-uuid' },
          wallets: { 'mock-uuid': '{}' },
        },
      });
    });
  });

  describe('update', () => {
    it('updates the account when staged changes exist', async () => {
      // Initial store state with existing account
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"original":"data"}' },
        },
      });

      // Mock account that returns a staged changeset
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      const staged = {
        merge: jest.fn(),
        to_json: jest.fn().mockReturnValue('{"merged":"data"}'),
      } as unknown as ChangeSet;
      mockAccount.takeStaged.mockReturnValue(staged);

      await repo.update(mockAccount);

      expect(staged.merge).toHaveBeenCalled();
      expect(mockSnapClient.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"merged":"data"}' },
        },
      });
    });

    it('does nothing if account has no staged changes', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"original":"data"}' },
        },
      });

      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.takeStaged.mockReturnValue(undefined);

      await repo.update(mockAccount);

      expect(mockSnapClient.set).not.toHaveBeenCalled();
    });

    it('throws an error if account does not exist in store', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: {},
          wallets: {},
        },
      });

      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'non-existent-id';

      await expect(repo.update(mockAccount)).rejects.toThrow(
        'Inconsistent state: account not found for update',
      );
    });
  });
});
