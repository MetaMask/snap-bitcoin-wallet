import type { JsonSLIP10Node } from '@metamask/key-tree';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import type { SnapStore } from '../infra';
import { BdkAccountAdapter } from '../infra';
import { SnapAccountRepository } from './SnapAccountRepository';

// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('bdk', () => {
  return {
    slip10_to_extended: jest.fn().mockReturnValue('mock-extended'),
    xpriv_to_descriptor: jest
      .fn()
      .mockReturnValue({ external: 'ext-desc', internal: 'int-desc' }),
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

describe('SnapAccountRepository', () => {
  let repo: SnapAccountRepository;
  const mockStore = mock<SnapStore>();

  beforeEach(() => {
    repo = new SnapAccountRepository(mockStore);
  });

  describe('get', () => {
    it('returns null if account not found', async () => {
      mockStore.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });

      const result = await repo.get('non-existent-id');
      expect(result).toBeNull();
      expect(BdkAccountAdapter.load).not.toHaveBeenCalled();
    });

    it('returns loaded account if found', async () => {
      mockStore.get.mockResolvedValue({
        accounts: {
          derivationPaths: {},
          wallets: { 'some-id': '{}' },
        },
      });

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);

      const result = await repo.get('some-id');
      expect(result).toBe(mockAccount);
      expect(BdkAccountAdapter.load).toHaveBeenCalledWith('some-id', '{}');
    });
  });

  describe('getByDerivationPath', () => {
    it('returns null if derivation path not mapped', async () => {
      mockStore.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });

      const result = await repo.getByDerivationPath(['m', "84'", "0'", "0'"]);
      expect(result).toBeNull();
    });

    it('returns account if derivation path exists', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      mockStore.get.mockResolvedValue({
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
    it('inserts a new account with xpriv if privateKey is present', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      mockStore.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });
      mockStore.getSLIP10.mockResolvedValue({
        privateKey: new Uint8Array([1, 2, 3]),
        masterFingerprint: 0xdeadbeef,
      } as unknown as JsonSLIP10Node);

      const mockAccount = {
        takeStaged: () => ({ to_json: () => '{}' }),
      } as unknown as BitcoinAccount;
      (BdkAccountAdapter.create as jest.Mock).mockReturnValue(mockAccount);

      await repo.insert(derivationPath, 'bitcoin', 'p2wpkh');

      expect(mockStore.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'mock-uuid' },
          wallets: { 'mock-uuid': '{}' },
        },
      });
    });

    it('inserts a new account with xpub if privateKey is not present', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      mockStore.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });
      mockStore.getSLIP10.mockResolvedValue({
        masterFingerprint: 0xdeadbeef,
      } as unknown as JsonSLIP10Node);

      const mockAccount = {
        takeStaged: () => ({ to_json: () => '{}' }),
      } as unknown as BitcoinAccount;
      (BdkAccountAdapter.create as jest.Mock).mockReturnValue(mockAccount);

      await repo.insert(derivationPath, 'bitcoin', 'p2wpkh');

      expect(mockStore.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'mock-uuid' },
          wallets: { 'mock-uuid': '{}' },
        },
      });
    });
  });
});
