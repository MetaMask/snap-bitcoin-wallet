import type { JsonSLIP10Node } from '@metamask/key-tree';
import { ChangeSet, AddressType, Network } from 'bdk_wasm';
import { mock } from 'jest-mock-extended';
import { v4 as uuidv4 } from 'uuid';

import type { BitcoinAccount } from '../entities';
import { BdkAccountAdapter } from '../infra';
import type { SnapStore } from '../infra';
import { SnapAccountRepository } from './SnapAccountRepository';

jest.mock('../infra/BdkAccountAdapter', () => ({
  BdkAccountAdapter: {
    load: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('SnapAccountRepository', () => {
  const mockStore = mock<SnapStore>();
  let repo: SnapAccountRepository;

  beforeEach(() => {
    repo = new SnapAccountRepository(mockStore);
  });

  describe('get', () => {
    it('returns null if no account found', async () => {
      mockStore.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: {} },
      });

      const result = await repo.get('some-id');
      expect(result).toBeNull();
    });

    it('returns loaded account if found', async () => {
      const walletJson = '{}';
      mockStore.get.mockResolvedValue({
        accounts: { derivationPaths: {}, wallets: { 'some-id': walletJson } },
      });

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);

      const result = await repo.get('some-id');
      expect(result).toBe(mockAccount);
      expect(BdkAccountAdapter.load).toHaveBeenCalledWith(
        'some-id',
        walletJson,
      );
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

    it('returns account if derivation path maps to an existing wallet', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      const walletJson = '{}';

      mockStore.get.mockResolvedValue({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'some-id' },
          wallets: { 'some-id': walletJson },
        },
      });

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);

      const result = await repo.getByDerivationPath(derivationPath);
      expect(result).toBe(mockAccount);
      expect(BdkAccountAdapter.load).toHaveBeenCalledWith(
        'some-id',
        walletJson,
      );
    });
  });

  describe('insert', () => {
    it('creates and persists a new account with xpriv if privateKey is available', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      const slip10 = {
        privateKey: 'mock-private-key',
        masterFingerprint: 0xdeadbeef,
      } as unknown as JsonSLIP10Node;
      const state = {
        accounts: { derivationPaths: {}, wallets: {} },
      };

      mockStore.get.mockResolvedValue(state);
      mockStore.getSLIP10.mockResolvedValue(slip10);

      const mockAccount = {
        takeStaged: () => ChangeSet.from_json('{}'),
      } as unknown as BitcoinAccount;
      (BdkAccountAdapter.create as jest.Mock).mockReturnValue(mockAccount);

      await repo.insert(derivationPath, Network.Bitcoin, AddressType.P2wpkh);

      expect(uuidv4).toHaveBeenCalled();
      expect(mockStore.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'mock-uuid' },
          wallets: { 'mock-uuid': '{}' },
        },
      });
      expect(BdkAccountAdapter.create).toHaveBeenCalled();
    });

    it('creates and persists a new account with xpub if no privateKey', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      const slip10 = {
        masterFingerprint: 0xdeadbeef,
      } as unknown as JsonSLIP10Node;
      const state = {
        accounts: { derivationPaths: {}, wallets: {} },
      };

      mockStore.get.mockResolvedValue(state);
      mockStore.getSLIP10.mockResolvedValue(slip10);

      const mockAccount = {
        takeStaged: () => ChangeSet.from_json('{}'),
      } as unknown as BitcoinAccount;
      (BdkAccountAdapter.create as jest.Mock).mockReturnValue(mockAccount);

      await repo.insert(derivationPath, Network.Bitcoin, AddressType.P2wpkh);

      expect(mockStore.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'mock-uuid' },
          wallets: { 'mock-uuid': '{}' },
        },
      });
      expect(BdkAccountAdapter.create).toHaveBeenCalled();
    });
  });
});
