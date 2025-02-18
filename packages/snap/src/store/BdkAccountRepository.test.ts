import type { SLIP10Node } from '@metamask/key-tree';
import { ChangeSet } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount, SnapClient } from '../entities';
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
    xpriv_to_descriptor: jest
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
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
      });

      const result = await repo.get('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns loaded account if found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: {},
          wallets: { 'some-id': '{"mywallet": "data"}' },
          inscriptions: {},
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

  describe('getAll', () => {
    it('returns all accounts', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: {},
          wallets: {
            'some-id': '{"foo":"bar"}',
            'another-id': '{"hello":"world"}',
          },
          inscriptions: {},
        },
      });

      const mockAccount1 = {} as BitcoinAccount;
      const mockAccount2 = {} as BitcoinAccount;

      (ChangeSet.from_json as jest.Mock).mockImplementation((json) => json);
      (BdkAccountAdapter.load as jest.Mock)
        .mockReturnValueOnce(mockAccount1)
        .mockReturnValueOnce(mockAccount2);

      const result = await repo.getAll();
      expect(result).toStrictEqual([mockAccount1, mockAccount2]);
      expect(BdkAccountAdapter.load).toHaveBeenCalledTimes(2);
    });
  });

  describe('getByDerivationPath', () => {
    it('returns null if derivation path not mapped', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
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
          inscriptions: {},
        },
      });

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);

      const result = await repo.getByDerivationPath(derivationPath);
      expect(result).toBe(mockAccount);
    });
  });

  describe('getWithSigner', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
      });
      const result = await repo.getWithSigner('non-existent-id');
      expect(result).toBeNull();
    });

    it('throws error if derivation path not found', async () => {
      const walletData = '{"mywallet":"data"}';
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: {},
          wallets: { 'some-id': walletData },
          inscriptions: {},
        },
      });
      await expect(repo.getWithSigner('some-id')).rejects.toThrow(
        'Inconsistent state. No derivation path found for account some-id',
      );
    });

    it('returns account with signer if account exists', async () => {
      const derivationPath = "m/84'/0'/0'";
      const walletData = '{"mywallet":"data"}';
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: { [derivationPath]: 'some-id' },
          wallets: { 'some-id': walletData },
          inscriptions: {},
        },
      });
      const slip10Node = {
        masterFingerprint: 0xdeadbeef,
      } as unknown as SLIP10Node;
      mockSnapClient.getPrivateEntropy.mockResolvedValue(slip10Node);
      const mockAccount = mock<BitcoinAccount>({
        network: 'bitcoin',
        addressType: 'p2wpkh',
      });
      const mockAccountWithSigner = mock<BitcoinAccount>();

      (BdkAccountAdapter.load as jest.Mock)
        .mockReturnValueOnce(mockAccount)
        .mockReturnValueOnce(mockAccountWithSigner);

      const result = await repo.getWithSigner('some-id');

      expect(mockSnapClient.getPrivateEntropy).toHaveBeenCalledWith([
        'm',
        "84'",
        "0'",
        "0'",
      ]);
      expect(result).toBe(mockAccountWithSigner);
    });
  });

  describe('insert', () => {
    it('inserts a new account with xpub', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
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
          inscriptions: {},
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
          inscriptions: {},
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
          inscriptions: {},
        },
      });

      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'non-existent-id';

      await expect(repo.update(mockAccount)).rejects.toThrow(
        'Inconsistent state: account not found for update',
      );
    });
  });

  describe('delete', () => {
    it('does nothing if account not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
      });

      await repo.delete('non-existent-id');

      expect(mockSnapClient.set).not.toHaveBeenCalled();
    });

    it('removes wallet data and derivation path from store if present', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"wallet":"data"}' },
          inscriptions: {},
        },
      });

      await repo.delete('some-id');

      expect(mockSnapClient.set).toHaveBeenCalledWith({
        accounts: { derivationPaths: {}, wallets: {} },
      });
    });
  });
});
