import type { AddressType, Network } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
} from '../entities';
import type { SnapClient } from '../entities/snap';
import { AccountUseCases } from './AccountUseCases';

jest.mock('../utils/logger');

describe('AccountUseCases', () => {
  let useCases: AccountUseCases;

  const mockSnapClient = mock<SnapClient>();
  const mockRepository = mock<BitcoinAccountRepository>();
  const mockChain = mock<BlockchainClient>();
  const accountsConfig: AccountsConfig = {
    index: 0,
    defaultAddressType: 'p2wpkh',
    defaultNetwork: 'bitcoin',
  };

  beforeEach(() => {
    useCases = new AccountUseCases(
      mockSnapClient,
      mockRepository,
      mockChain,
      accountsConfig,
    );
  });

  describe('get', () => {
    it('returns account', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';

      mockRepository.get.mockResolvedValue(mockAccount);

      const result = await useCases.get('some-id');

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(result).toBe(mockAccount);
    });

    it('throws Error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(useCases.get('some-id')).rejects.toThrow(
        'Account not found: some-id',
      );

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
    });

    it('propagates an error if the repository get fails', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';

      const error = new Error('Get failed');
      mockRepository.get.mockRejectedValue(error);

      await expect(useCases.synchronize('some-id')).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
    });
  });

  describe('create', () => {
    const network: Network = 'bitcoin';
    const addressType: AddressType = 'p2wpkh';
    const mockAccount = mock<BitcoinAccount>();

    beforeEach(() => {
      mockRepository.insert.mockResolvedValue(mockAccount);
    });

    it.each([
      { tAddressType: 'p2pkh', purpose: "44'" },
      { tAddressType: 'p2sh', purpose: "49'" },
      { tAddressType: 'p2wsh', purpose: "45'" },
      { tAddressType: 'p2wpkh', purpose: "84'" },
      { tAddressType: 'p2tr', purpose: "86'" },
    ] as { tAddressType: AddressType; purpose: string }[])(
      'creates an account of type: %s',
      async ({ tAddressType, purpose }) => {
        const derivationPath = ['m', purpose, "0'", `${accountsConfig.index}'`];

        await useCases.create(network, tAddressType);

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          derivationPath,
        );
        expect(mockRepository.insert).toHaveBeenCalledWith(
          derivationPath,
          network,
          tAddressType,
        );
        expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalledWith(
          mockAccount,
        );
      },
    );

    it.each([
      { tNetwork: 'bitcoin', coinType: "0'" },
      { tNetwork: 'testnet', coinType: "1'" },
      { tNetwork: 'testnet4', coinType: "1'" },
      { tNetwork: 'signet', coinType: "1'" },
      { tNetwork: 'regtest', coinType: "1'" },
    ] as { tNetwork: Network; coinType: string }[])(
      'should create an account on network: %s',
      async ({ tNetwork, coinType }) => {
        const expectedDerivationPath = [
          'm',
          "84'",
          coinType,
          `${accountsConfig.index}'`,
        ];

        await useCases.create(tNetwork, addressType);

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          expectedDerivationPath,
        );
        expect(mockRepository.insert).toHaveBeenCalledWith(
          expectedDerivationPath,
          tNetwork,
          addressType,
        );
        expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalledWith(
          mockAccount,
        );
      },
    );

    it('returns an existing account if one already exists', async () => {
      const mockExistingAccount = mock<BitcoinAccount>();
      mockRepository.getByDerivationPath.mockResolvedValue(mockExistingAccount);

      const result = await useCases.create(network, addressType);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).not.toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).not.toHaveBeenCalled();

      expect(result).toBe(mockExistingAccount);
    });

    it('creates a new account if one does not exist', async () => {
      mockRepository.getByDerivationPath.mockResolvedValue(null);

      const result = await useCases.create(network, addressType);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();

      expect(result).toBe(mockAccount);
    });

    it('propagates an error if getByDerivationPath throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockRejectedValue(error);

      await expect(useCases.create(network, addressType)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).not.toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).not.toHaveBeenCalled();
    });

    it('propagates an error if insert throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockResolvedValue(null);
      mockRepository.insert.mockRejectedValue(error);

      await expect(useCases.create(network, addressType)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).not.toHaveBeenCalled();
    });

    it('propagates an error if emitAccountCreatedEvent throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockResolvedValue(null);
      mockSnapClient.emitAccountCreatedEvent.mockRejectedValue(error);

      await expect(useCases.create(network, addressType)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
    });
  });

  describe('synchronize', () => {
    it('throws Error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(useCases.synchronize('some-id')).rejects.toThrow(
        'Account not found: some-id',
      );

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(mockChain.sync).not.toHaveBeenCalled();
      expect(mockChain.fullScan).not.toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('performs a regular sync if the account is already scanned', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.isScanned = true;

      mockRepository.get.mockResolvedValue(mockAccount);

      const result = await useCases.synchronize('some-id');

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockChain.fullScan).not.toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(result).toBe(mockAccount);
    });

    it('performs a full scan if the account is not scanned', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.isScanned = false;

      mockRepository.get.mockResolvedValue(mockAccount);

      const result = await useCases.synchronize('some-id');

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
      expect(mockChain.sync).not.toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(result).toBe(mockAccount);
    });

    it('propagates an error if the chain sync fails', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.isScanned = true;

      mockRepository.get.mockResolvedValue(mockAccount);
      const error = new Error('Sync failed');
      mockChain.sync.mockRejectedValue(error);

      await expect(useCases.synchronize('some-id')).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('propagates an error if the chain full scan fails', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.isScanned = false;

      mockRepository.get.mockResolvedValue(mockAccount);
      const error = new Error('Full scan failed');
      mockChain.fullScan.mockRejectedValue(error);

      await expect(useCases.synchronize('some-id')).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('propagates an error if the repository update fails', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.isScanned = true;

      mockRepository.get.mockResolvedValue(mockAccount);
      mockChain.sync.mockResolvedValue();
      const error = new Error('Update failed');
      mockRepository.update.mockRejectedValue(error);

      await expect(useCases.synchronize('some-id')).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
    });
  });

  describe('delete', () => {
    it('does nothing if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await useCases.delete('non-existent-id');

      expect(mockRepository.get).toHaveBeenCalledWith('non-existent-id');
      expect(mockSnapClient.emitAccountDeletedEvent).not.toHaveBeenCalled();
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('throws error if account is the default account', async () => {
      const defaultAccount = mock<BitcoinAccount>();
      defaultAccount.id = 'default-id';
      defaultAccount.addressType =
        accountsConfig.defaultAddressType as AddressType;
      defaultAccount.network = accountsConfig.defaultNetwork as Network;

      mockRepository.get.mockResolvedValue(defaultAccount);

      await expect(useCases.delete('default-id')).rejects.toThrow(
        'Default Bitcoin account cannot be removed',
      );

      expect(mockRepository.get).toHaveBeenCalledWith('default-id');
      expect(mockSnapClient.emitAccountDeletedEvent).not.toHaveBeenCalled();
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('removes account if not default', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.addressType = 'p2wpkh';
      mockAccount.network = 'testnet';

      mockRepository.get.mockResolvedValue(mockAccount);

      await useCases.delete(mockAccount.id);

      expect(mockRepository.get).toHaveBeenCalledWith(mockAccount.id);
      expect(mockSnapClient.emitAccountDeletedEvent).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockRepository.delete).toHaveBeenCalledWith(mockAccount.id);
    });

    it('propagates an error if the event emitting fails', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.addressType = 'p2wpkh';
      mockAccount.network = 'testnet';
      const error = new Error('Event emit failed');

      mockRepository.get.mockResolvedValue(mockAccount);
      mockSnapClient.emitAccountDeletedEvent.mockRejectedValue(error);

      await expect(useCases.delete(mockAccount.id)).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountDeletedEvent).toHaveBeenCalled();
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('propagates an error if the repository fails', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';
      mockAccount.addressType = 'p2wpkh';
      mockAccount.network = 'testnet';
      const error = new Error('Delete failed');

      mockRepository.get.mockResolvedValue(mockAccount);
      mockRepository.delete.mockRejectedValue(error);

      await expect(useCases.delete(mockAccount.id)).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountDeletedEvent).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalled();
    });
  });
});
