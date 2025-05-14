import type {
  Transaction,
  Txid,
  WalletTx,
  AddressType,
  Network,
  Psbt,
} from '@metamask/bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  Inscription,
  Logger,
  MetaProtocolsClient,
  SnapClient,
} from '../entities';
import { AccountUseCases } from './AccountUseCases';

describe('AccountUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockSnapClient = mock<SnapClient>();
  const mockRepository = mock<BitcoinAccountRepository>();
  const mockChain = mock<BlockchainClient>();
  const mockMetaProtocols = mock<MetaProtocolsClient>();
  const accountsConfig: AccountsConfig = {
    defaultAddressType: 'p2wpkh',
  };

  const useCases = new AccountUseCases(
    mockLogger,
    mockSnapClient,
    mockRepository,
    mockChain,
    accountsConfig,
    mockMetaProtocols,
  );

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

      await expect(useCases.get('some-id')).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalledWith('some-id');
    });
  });

  describe('list', () => {
    it('returns accounts', async () => {
      const mockAccount = mock<BitcoinAccount>();

      mockRepository.getAll.mockResolvedValue([mockAccount]);

      const result = await useCases.list();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toStrictEqual([mockAccount]);
    });

    it('propagates an error if the repository getAll fails', async () => {
      const error = new Error('Get failed');
      mockRepository.getAll.mockRejectedValue(error);

      await expect(useCases.list()).rejects.toBe(error);

      expect(mockRepository.getAll).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const network: Network = 'bitcoin';
    const addressType: AddressType = 'p2wpkh';
    const entropySource = 'some-source';
    const index = 1;
    const correlationId = 'some-correlation-id';

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
        const derivationPath = [entropySource, purpose, "0'", `${index}'`];

        await useCases.create(
          network,
          entropySource,
          index,
          tAddressType,
          correlationId,
        );

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
          correlationId,
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
          entropySource,
          "84'",
          coinType,
          `${index}'`,
        ];

        await useCases.create(
          tNetwork,
          entropySource,
          index,
          addressType,
          correlationId,
        );

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
          correlationId,
        );
      },
    );

    it('returns an existing account if one already exists', async () => {
      const mockExistingAccount = mock<BitcoinAccount>();
      mockRepository.getByDerivationPath.mockResolvedValue(mockExistingAccount);

      const result = await useCases.create(
        network,
        entropySource,
        index,
        addressType,
      );

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).not.toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();

      expect(result).toBe(mockExistingAccount);
    });

    it('creates a new account if one does not exist', async () => {
      mockRepository.getByDerivationPath.mockResolvedValue(null);

      const result = await useCases.create(
        network,
        entropySource,
        index,
        addressType,
      );

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();

      expect(result).toBe(mockAccount);
    });

    it('propagates an error if getByDerivationPath throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockRejectedValue(error);

      await expect(
        useCases.create(network, entropySource, index, addressType),
      ).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).not.toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).not.toHaveBeenCalled();
    });

    it('propagates an error if insert throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockResolvedValue(null);
      mockRepository.insert.mockRejectedValue(error);

      await expect(
        useCases.create(network, entropySource, index, addressType),
      ).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).not.toHaveBeenCalled();
    });

    it('propagates an error if emitAccountCreatedEvent throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockResolvedValue(null);
      mockSnapClient.emitAccountCreatedEvent.mockRejectedValue(error);

      await expect(
        useCases.create(network, entropySource, index, addressType),
      ).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
    });
  });

  describe('synchronize', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'some-id',
      isScanned: true,
      listTransactions: jest.fn(),
    });

    beforeEach(() => {
      mockAccount.listTransactions.mockReturnValue([]);
    });

    it('does not sync if account is not scanned', async () => {
      mockAccount.listTransactions.mockReturnValue([]);

      await useCases.synchronize({ ...mockAccount, isScanned: false });

      expect(mockChain.sync).not.toHaveBeenCalled();
      expect(mockAccount.listTransactions).not.toHaveBeenCalled();
    });

    it('synchronizes', async () => {
      mockAccount.listTransactions.mockReturnValue([]);

      await useCases.synchronize(mockAccount);

      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockAccount.listTransactions).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
    });

    it('synchronizes with new transactions', async () => {
      const mockInscriptions = mock<Inscription[]>();
      const mockTransaction = mock<WalletTx>();
      mockAccount.listTransactions
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockTransaction]);
      mockMetaProtocols.fetchInscriptions.mockResolvedValue(mockInscriptions);

      await useCases.synchronize(mockAccount);

      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockAccount.listTransactions).toHaveBeenCalledTimes(2);
      expect(mockMetaProtocols.fetchInscriptions).toHaveBeenCalledWith(
        mockAccount,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockAccount,
        mockInscriptions,
      );
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, [mockTransaction]);
    });

    it('synchronizes with confirmed transactions', async () => {
      const mockTxPending = mock<WalletTx>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: false },
        txid: {
          toString: () => 'txid',
        },
      });
      const mockTxConfirmed = mock<WalletTx>({
        ...mockTxPending,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: true },
      });
      mockAccount.listTransactions
        .mockReturnValueOnce([mockTxPending])
        .mockReturnValueOnce([mockTxConfirmed]);

      await useCases.synchronize(mockAccount);

      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockAccount.listTransactions).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, [mockTxConfirmed]);
    });

    it('propagates an error if the chain sync fails', async () => {
      const error = new Error('Sync failed');
      mockChain.sync.mockRejectedValue(error);

      await expect(useCases.synchronize(mockAccount)).rejects.toBe(error);

      expect(mockChain.sync).toHaveBeenCalled();
    });

    it('propagates an error if the repository update fails', async () => {
      mockChain.sync.mockResolvedValue();
      const error = new Error('Update failed');
      mockRepository.update.mockRejectedValue(error);

      await expect(useCases.synchronize(mockAccount)).rejects.toBe(error);

      expect(mockChain.sync).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('does not synchronize assets if utxo protection is disabled', async () => {
      const testUseCases = new AccountUseCases(
        mockLogger,
        mockSnapClient,
        mockRepository,
        mockChain,
        accountsConfig,
        undefined,
      );
      const mockTransaction = mock<WalletTx>();
      mockAccount.listTransactions
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockTransaction]);

      await testUseCases.synchronize(mockAccount);

      expect(mockMetaProtocols.fetchInscriptions).not.toHaveBeenCalled();
    });
  });

  describe('fullScan', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'some-id',
      isScanned: false,
    });
    const mockInscriptions = mock<Inscription[]>();
    const mockTransactions = mock<WalletTx[]>();

    it('performs a full scan', async () => {
      mockAccount.listTransactions.mockReturnValue(mockTransactions);
      mockMetaProtocols.fetchInscriptions.mockResolvedValue(mockInscriptions);

      await useCases.fullScan(mockAccount);

      expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
      expect(mockMetaProtocols.fetchInscriptions).toHaveBeenCalledWith(
        mockAccount,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockAccount,
        mockInscriptions,
      );
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, mockTransactions);
    });

    it('propagates an error if the chain full scan fails', async () => {
      const error = new Error('Full scan failed');
      mockChain.fullScan.mockRejectedValue(error);

      await expect(useCases.fullScan(mockAccount)).rejects.toBe(error);

      expect(mockChain.fullScan).toHaveBeenCalled();
    });

    it('propagates an error if fetchInscriptions fails', async () => {
      mockChain.fullScan.mockResolvedValue();
      const error = new Error('fetchInscriptions failed');
      mockMetaProtocols.fetchInscriptions.mockRejectedValue(error);

      await expect(useCases.fullScan(mockAccount)).rejects.toBe(error);

      expect(mockChain.fullScan).toHaveBeenCalled();
      expect(mockMetaProtocols.fetchInscriptions).toHaveBeenCalled();
    });

    it('propagates an error if the repository update fails', async () => {
      mockChain.fullScan.mockResolvedValue();
      mockMetaProtocols.fetchInscriptions.mockResolvedValue(mockInscriptions);
      const error = new Error('Update failed');
      mockRepository.update.mockRejectedValue(error);

      await expect(useCases.fullScan(mockAccount)).rejects.toBe(error);

      expect(mockChain.fullScan).toHaveBeenCalled();
      expect(mockMetaProtocols.fetchInscriptions).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('does not scans for assets if utxo protection is disabled', async () => {
      const testUseCases = new AccountUseCases(
        mockLogger,
        mockSnapClient,
        mockRepository,
        mockChain,
        accountsConfig,
        undefined,
      );
      mockAccount.listTransactions.mockReturnValue(mockTransactions);

      await testUseCases.synchronize(mockAccount);

      expect(mockMetaProtocols.fetchInscriptions).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(useCases.delete('non-existent-id')).rejects.toThrow(
        'Account not found: non-existent-id',
      );

      expect(mockRepository.get).toHaveBeenCalledWith('non-existent-id');
      expect(mockSnapClient.emitAccountDeletedEvent).not.toHaveBeenCalled();
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('removes an account', async () => {
      const mockAccount = mock<BitcoinAccount>();
      mockAccount.id = 'some-id';

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
      const error = new Error('Delete failed');

      mockRepository.get.mockResolvedValue(mockAccount);
      mockRepository.delete.mockRejectedValue(error);

      await expect(useCases.delete(mockAccount.id)).rejects.toBe(error);

      expect(mockRepository.get).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountDeletedEvent).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalled();
    });
  });

  describe('sendPsbt', () => {
    const mockTxid = mock<Txid>();
    const mockPsbt = mock<Psbt>();
    const mockTransaction = mock<Transaction>({
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      compute_txid: jest.fn(),
      clone: jest.fn(),
    });
    const mockAccount = mock<BitcoinAccount>({
      network: 'bitcoin',
      sign: jest.fn(),
    });
    const mockWalletTx = mock<WalletTx>();

    beforeEach(() => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);
      mockTransaction.clone.mockReturnThis();
    });

    it('throws error if account is not found', async () => {
      mockRepository.getWithSigner.mockResolvedValue(null);

      await expect(
        useCases.sendPsbt('non-existent-id', mockPsbt),
      ).rejects.toThrow('Account not found: non-existent-id');
    });

    it('sends transaction', async () => {
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);

      const txId = await useCases.sendPsbt('account-id', mockPsbt);

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockAccount.sign).toHaveBeenCalledWith(mockPsbt);
      expect(mockChain.broadcast).toHaveBeenCalledWith(
        mockAccount.network,
        mockTransaction,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(mockTransaction.compute_txid).toHaveBeenCalled();
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, [mockWalletTx]);
      expect(txId).toBe(mockTxid);
    });

    it('propagates an error if getWithSigner fails', async () => {
      const error = new Error('getWithSigner failed');
      mockRepository.getWithSigner.mockRejectedValueOnce(error);

      await expect(useCases.sendPsbt('account-id', mockPsbt)).rejects.toBe(
        error,
      );
    });

    it('propagates an error if broadcast fails', async () => {
      const error = new Error('broadcast failed');
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockChain.broadcast.mockRejectedValueOnce(error);

      await expect(useCases.sendPsbt('account-id', mockPsbt)).rejects.toBe(
        error,
      );
    });

    it('propagates an error if update fails', async () => {
      const error = new Error('update failed');
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockRepository.update.mockRejectedValue(error);

      await expect(useCases.sendPsbt('account-id', mockPsbt)).rejects.toBe(
        error,
      );
    });
  });
});
