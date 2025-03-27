import { ChangeSet } from '@metamask/bitcoindevkit';
import type { SLIP10Node } from '@metamask/key-tree';
import { mock } from 'jest-mock-extended';

import type {
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
  const mockState = mock<SnapState>();

  beforeEach(() => {
    repo = new BdkAccountRepository(mockSnapClient);
  });

  describe('get', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { ...mockState.accounts, wallets: {} },
      });

      const result = await repo.get('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns loaded account if found', async () => {
      const state = mock<SnapState>({
        accounts: {
          wallets: { 'some-id': '{"mywallet": "data"}' },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);

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
      const state = mock<SnapState>({
        accounts: {
          wallets: {
            'some-id': '{"foo":"bar"}',
            'another-id': '{"hello":"world"}',
          },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);

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
        accounts: { ...mockState.accounts, derivationPaths: {} },
      });

      const result = await repo.getByDerivationPath(['m', "84'", "0'", "0'"]);
      expect(result).toBeNull();
    });

    it('returns account if derivation path exists', async () => {
      const derivationPath = ['m', "84'", "0'", "0'"];
      const state = mock<SnapState>({
        accounts: {
          derivationPaths: { [derivationPath.join('/')]: 'some-id' },
          wallets: { 'some-id': '{}' },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);

      const mockAccount = {} as BitcoinAccount;
      (BdkAccountAdapter.load as jest.Mock).mockReturnValue(mockAccount);

      const result = await repo.getByDerivationPath(derivationPath);
      expect(result).toBe(mockAccount);
    });
  });

  describe('getWithSigner', () => {
    it('returns null if account not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { ...mockState.accounts, wallets: {} },
      });
      const result = await repo.getWithSigner('non-existent-id');
      expect(result).toBeNull();
    });

    it('throws error if derivation path not found', async () => {
      const walletData = '{"mywallet":"data"}';
      const state = mock<SnapState>({
        accounts: {
          wallets: { 'some-id': walletData },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);

      await expect(repo.getWithSigner('some-id')).rejects.toThrow(
        'Inconsistent state. No derivation path found for account some-id',
      );
    });

    it('returns account with signer if account exists', async () => {
      const derivationPath = "m/84'/0'/0'";
      const walletData = '{"mywallet":"data"}';
      const state = mock<SnapState>({
        accounts: {
          derivationPaths: { [derivationPath]: 'some-id' },
          wallets: { 'some-id': walletData },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);
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
      const state = {
        accounts: {
          derivationPaths: {},
          wallets: {},
          inscriptions: {},
        },
      };
      mockSnapClient.get.mockResolvedValue(state);
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
          inscriptions: { 'mock-uuid': [] },
        },
      });
    });
  });

  describe('update', () => {
    it('updates the account and inscriptions when staged changes exist', async () => {
      const state = {
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"original":"data"}' },
          inscriptions: {},
        },
      };
      mockSnapClient.get.mockResolvedValue(state);
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      const staged = {
        merge: jest.fn(),
        to_json: jest.fn().mockReturnValue('{"merged":"data"}'),
      } as unknown as ChangeSet;
      mockAccount.takeStaged.mockReturnValue(staged);

      await repo.update(mockAccount, [{ id: 'myInscription' } as Inscription]);

      expect(staged.merge).toHaveBeenCalled();
      expect(mockSnapClient.set).toHaveBeenCalledWith({
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          inscriptions: { 'some-id': [{ id: 'myInscription' }] },
          wallets: { 'some-id': '{"merged":"data"}' },
        },
      });
    });

    it('does nothing if account has no staged changes', async () => {
      const state = mock<SnapState>({
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"original":"data"}' },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.takeStaged.mockReturnValue(undefined);

      await repo.update(mockAccount);

      expect(mockSnapClient.set).not.toHaveBeenCalled();
    });

    it('throws an error if account does not exist in store', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.takeStaged.mockReturnValue(mock<ChangeSet>());
      mockSnapClient.get.mockResolvedValue({
        accounts: { ...mockState.accounts, wallets: {} },
      });
      mockAccount.id = 'non-existent-id';

      await expect(repo.update(mockAccount)).rejects.toThrow(
        'Inconsistent state: account not found for update',
      );
    });
  });

  describe('delete', () => {
    it('does nothing if account not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { ...mockState.accounts, wallets: {} },
      });

      await repo.delete('non-existent-id');

      expect(mockSnapClient.set).not.toHaveBeenCalled();
    });

    it('removes wallet data from store', async () => {
      const state = {
        accounts: {
          derivationPaths: { "m/84'/0'/0'": 'some-id' },
          wallets: { 'some-id': '{"wallet":"data"}' },
          inscriptions: { 'some-id': [] },
        },
      };
      mockSnapClient.get.mockResolvedValue(state);

      await repo.delete('some-id');

      expect(mockSnapClient.set).toHaveBeenCalledWith({
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
      });
    });
  });

  describe('getFrozenUTXOs', () => {
    it('returns empty array if account is not found', async () => {
      mockSnapClient.get.mockResolvedValue({
        accounts: { ...mockState.accounts, inscriptions: {} },
      });

      const result = await repo.getFrozenUTXOs('non-existent-id');
      expect(result).toStrictEqual([]);
    });

    it('returns the list of frozen UTXO outpoints', async () => {
      const state = mock<SnapState>({
        accounts: {
          inscriptions: {
            'some-id': [
              { location: 'txid1:vout:offset' },
              { location: 'txid2:vout:offset' },
            ],
          },
        },
      });
      mockSnapClient.get.mockResolvedValue(state);

      const result = await repo.getFrozenUTXOs('some-id');

      expect(mockSnapClient.get).toHaveBeenCalled();
      expect(result).toStrictEqual(['txid1:vout', 'txid2:vout']);
    });
  });
});
