import type {
  TxOut,
  ScriptBuf,
  Amount,
  Transaction,
  Txid,
  WalletTx,
  AddressType,
  Network,
  Psbt,
} from '@metamask/bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  Inscription,
  Logger,
  MetaProtocolsClient,
  SnapClient,
  TransactionBuilder,
} from '../entities';
import { TrackingSnapEvent, ValidationError } from '../entities';
import type {
  CreateAccountParams,
  DiscoverAccountParams,
} from './AccountUseCases';
import { AccountUseCases } from './AccountUseCases';

describe('AccountUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockSnapClient = mock<SnapClient>();
  const mockRepository = mock<BitcoinAccountRepository>();
  const mockChain = mock<BlockchainClient>();
  const mockMetaProtocols = mock<MetaProtocolsClient>();
  const fallbackFeeRate = 5.0;

  const useCases = new AccountUseCases(
    mockLogger,
    mockSnapClient,
    mockRepository,
    mockChain,
    fallbackFeeRate,
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
        'Account not found',
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
    const createParams: CreateAccountParams = {
      network: 'bitcoin',
      entropySource: 'some-source',
      index: 1,
      addressType: 'p2wpkh',
      synchronize: false,
      correlationId: 'correlation-id',
      accountName: 'My account',
    };
    const mockAccount = mock<BitcoinAccount>({ network: createParams.network });

    beforeEach(() => {
      mockRepository.create.mockResolvedValue(mockAccount);
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
        const derivationPath = [
          createParams.entropySource,
          purpose,
          "0'",
          `${createParams.index}'`,
        ];

        await useCases.create({
          ...createParams,
          addressType: tAddressType,
          synchronize: true,
        });

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          derivationPath,
        );
        expect(mockRepository.create).toHaveBeenCalledWith(
          derivationPath,
          createParams.network,
          tAddressType,
        );
        expect(mockAccount.revealNextAddress).toHaveBeenCalled();
        expect(mockRepository.insert).toHaveBeenCalledWith(mockAccount);
        expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalledWith(
          mockAccount,
          createParams.correlationId,
          createParams.accountName,
        );
        expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
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
          createParams.entropySource,
          "84'",
          coinType,
          `${createParams.index}'`,
        ];

        await useCases.create({
          ...createParams,
          network: tNetwork,
          synchronize: true,
        });

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          expectedDerivationPath,
        );
        expect(mockRepository.create).toHaveBeenCalledWith(
          expectedDerivationPath,
          tNetwork,
          createParams.addressType,
        );
        expect(mockRepository.insert).toHaveBeenCalledWith(mockAccount);
        expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalledWith(
          mockAccount,
          createParams.correlationId,
          createParams.accountName,
        );
        expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
      },
    );

    it('returns an existing account if one already exists on same network', async () => {
      mockRepository.getByDerivationPath.mockResolvedValue(mockAccount);

      const result = await useCases.create(createParams);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();

      expect(result).toBe(mockAccount);
    });

    it('propagates an error if getByDerivationPath throws', async () => {
      const error = new Error('getByDerivationPath failed');
      mockRepository.getByDerivationPath.mockRejectedValue(error);

      await expect(useCases.create(createParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('propagates an error if create throws', async () => {
      const error = new Error('create failed');
      mockRepository.create.mockRejectedValue(error);

      await expect(useCases.create(createParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('propagates an error if insert throws', async () => {
      const error = new Error('insert failed');
      mockRepository.insert.mockRejectedValue(error);

      await expect(useCases.create(createParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
    });

    it('propagates an error if emitAccountCreatedEvent throws', async () => {
      const error = new Error('emitAccountCreatedEvent failed');
      mockSnapClient.emitAccountCreatedEvent.mockRejectedValue(error);

      await expect(useCases.create(createParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
    });

    it('propagates an error if fullScan throws', async () => {
      const error = new Error('fullScan failed');
      mockChain.fullScan.mockRejectedValue(error);

      await expect(
        useCases.create({ ...createParams, synchronize: true }),
      ).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
      expect(mockChain.fullScan).toHaveBeenCalled();
    });
  });

  describe('discover', () => {
    const discoverParams: DiscoverAccountParams = {
      network: 'bitcoin',
      entropySource: 'some-source',
      index: 1,
      addressType: 'p2wpkh',
    };
    const mockAccount = mock<BitcoinAccount>({
      network: discoverParams.network,
    });

    beforeEach(() => {
      mockRepository.create.mockResolvedValue(mockAccount);
    });

    it.each([
      { tAddressType: 'p2pkh', purpose: "44'" },
      { tAddressType: 'p2sh', purpose: "49'" },
      { tAddressType: 'p2wsh', purpose: "45'" },
      { tAddressType: 'p2wpkh', purpose: "84'" },
      { tAddressType: 'p2tr', purpose: "86'" },
    ] as { tAddressType: AddressType; purpose: string }[])(
      'discovers an account of type: %s',
      async ({ tAddressType, purpose }) => {
        const derivationPath = [
          discoverParams.entropySource,
          purpose,
          "0'",
          `${discoverParams.index}'`,
        ];

        await useCases.discover({
          ...discoverParams,
          addressType: tAddressType,
        });

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          derivationPath,
        );
        expect(mockRepository.create).toHaveBeenCalledWith(
          derivationPath,
          discoverParams.network,
          tAddressType,
        );
        expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
      },
    );

    it.each([
      { tNetwork: 'bitcoin', coinType: "0'" },
      { tNetwork: 'testnet', coinType: "1'" },
      { tNetwork: 'testnet4', coinType: "1'" },
      { tNetwork: 'signet', coinType: "1'" },
      { tNetwork: 'regtest', coinType: "1'" },
    ] as { tNetwork: Network; coinType: string }[])(
      'should discover an account on network: %s',
      async ({ tNetwork, coinType }) => {
        const expectedDerivationPath = [
          discoverParams.entropySource,
          "84'",
          coinType,
          `${discoverParams.index}'`,
        ];

        await useCases.discover({
          ...discoverParams,
          network: tNetwork,
        });

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          expectedDerivationPath,
        );
        expect(mockRepository.create).toHaveBeenCalledWith(
          expectedDerivationPath,
          tNetwork,
          discoverParams.addressType,
        );
        expect(mockChain.fullScan).toHaveBeenCalledWith(mockAccount);
      },
    );

    it('returns an existing account if one already exists on same network', async () => {
      mockRepository.getByDerivationPath.mockResolvedValue(mockAccount);

      const result = await useCases.discover(discoverParams);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();

      expect(result).toBe(mockAccount);
    });

    it('propagates an error if getByDerivationPath throws', async () => {
      const error = new Error('getByDerivationPath failed');
      mockRepository.getByDerivationPath.mockRejectedValue(error);

      await expect(useCases.discover(discoverParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('propagates an error if create throws', async () => {
      const error = new Error('create failed');
      mockRepository.create.mockRejectedValue(error);

      await expect(useCases.discover(discoverParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('propagates an error if fullScan throws', async () => {
      const error = new Error('fullScan failed');
      mockChain.fullScan.mockRejectedValue(error);

      await expect(useCases.discover(discoverParams)).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockChain.fullScan).toHaveBeenCalled();
    });
  });

  describe('synchronize', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'some-id',
      listTransactions: jest.fn(),
    });

    beforeEach(() => {
      mockAccount.listTransactions.mockReturnValue([]);
    });

    it('synchronizes', async () => {
      mockAccount.listTransactions.mockReturnValue([]);

      await useCases.synchronize(mockAccount, 'test');

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

      await useCases.synchronize(mockAccount, 'test');

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
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionReceived,
        mockAccount,
        mockTransaction,
        'test',
      );
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledTimes(1);
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

      await useCases.synchronize(mockAccount, 'test');

      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockAccount.listTransactions).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, [mockTxConfirmed]);
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionFinalized,
        mockAccount,
        mockTxConfirmed,
        'test',
      );
    });

    it('synchronizes with both new and confirmed transactions', async () => {
      const mockTxPending = mock<WalletTx>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: false },
        txid: {
          toString: () => 'txid1',
        },
      });
      const mockTxNew = mock<WalletTx>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: false },
        txid: {
          toString: () => 'txid2',
        },
      });
      const mockTxConfirmed = mock<WalletTx>({
        ...mockTxPending,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: true },
      });

      const mockTxPreviouslyConfirmed = mock<WalletTx>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: true },
      });
      const mockTxReorged = mock<WalletTx>({
        ...mockTxPreviouslyConfirmed,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_position: { is_confirmed: false },
      });

      mockAccount.listTransactions
        .mockReturnValueOnce([mockTxPending, mockTxPreviouslyConfirmed])
        .mockReturnValueOnce([mockTxConfirmed, mockTxNew, mockTxReorged]);
      const mockInscriptions = mock<Inscription[]>();
      mockMetaProtocols.fetchInscriptions.mockResolvedValue(mockInscriptions);
      const origin = 'test';

      await useCases.synchronize(mockAccount, origin);

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
      ).toHaveBeenCalledWith(mockAccount, [
        mockTxConfirmed,
        mockTxNew,
        mockTxReorged,
      ]);

      // Check for TransactionFinalized event for confirmed transaction
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionFinalized,
        mockAccount,
        mockTxConfirmed,
        origin,
      );

      // Check for TransactionReceived event for new transaction
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionReceived,
        mockAccount,
        mockTxNew,
        origin,
      );

      // Check for TransactionReorged event for reorged transaction
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionReorged,
        mockAccount,
        mockTxReorged,
        origin,
      );

      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledTimes(3);
    });

    it('should emit TransactionReorged when a confirmed transaction becomes unconfirmed', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockTxConfirmed = mock<WalletTx>({
        chain_position: { is_confirmed: true },
      });
      const mockTxReorged = mock<WalletTx>({
        ...mockTxConfirmed,
        chain_position: { is_confirmed: false },
      });
      mockAccount.listTransactions
        .mockReturnValueOnce([mockTxConfirmed])
        .mockReturnValueOnce([mockTxReorged]);

      await useCases.synchronize(mockAccount, 'test');

      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledTimes(1);
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionReorged,
        mockAccount,
        mockTxReorged,
        'test',
      );
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, [mockTxReorged]);
    });

    it('propagates an error if the chain sync fails', async () => {
      const error = new Error('Sync failed');
      mockChain.sync.mockRejectedValue(error);

      await expect(useCases.synchronize(mockAccount, 'test')).rejects.toBe(
        error,
      );

      expect(mockChain.sync).toHaveBeenCalled();
    });

    it('propagates an error if the repository update fails', async () => {
      mockChain.sync.mockResolvedValue();
      const error = new Error('Update failed');
      mockRepository.update.mockRejectedValue(error);

      await expect(useCases.synchronize(mockAccount, 'test')).rejects.toBe(
        error,
      );

      expect(mockChain.sync).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('does not synchronize assets if utxo protection is disabled', async () => {
      const testUseCases = new AccountUseCases(
        mockLogger,
        mockSnapClient,
        mockRepository,
        mockChain,
        fallbackFeeRate,
        undefined,
      );
      const mockTransaction = mock<WalletTx>();
      mockAccount.listTransactions
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockTransaction]);

      await testUseCases.synchronize(mockAccount, 'test');

      expect(mockMetaProtocols.fetchInscriptions).not.toHaveBeenCalled();
    });
  });

  describe('fullScan', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'some-id',
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

    it('does not scan for assets if utxo protection is disabled', async () => {
      const testUseCases = new AccountUseCases(
        mockLogger,
        mockSnapClient,
        mockRepository,
        mockChain,
        fallbackFeeRate,
        undefined,
      );

      await testUseCases.fullScan(mockAccount);

      expect(mockMetaProtocols.fetchInscriptions).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(useCases.delete('non-existent-id')).rejects.toThrow(
        'Account not found',
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
        useCases.sendPsbt('non-existent-id', mockPsbt, 'metamask'),
      ).rejects.toThrow('Account not found');
    });

    it('sends transaction', async () => {
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const txId = await useCases.sendPsbt('account-id', mockPsbt, 'metamask');

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
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionSubmitted,
        mockAccount,
        mockWalletTx,
        'metamask',
      );
      expect(txId).toBe(mockTxid);
    });

    it('propagates an error if getWithSigner fails', async () => {
      const error = new Error('getWithSigner failed');
      mockRepository.getWithSigner.mockRejectedValueOnce(error);

      await expect(
        useCases.sendPsbt('account-id', mockPsbt, 'metamask'),
      ).rejects.toBe(error);
    });

    it('propagates an error if broadcast fails', async () => {
      const error = new Error('broadcast failed');
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockChain.broadcast.mockRejectedValueOnce(error);

      await expect(
        useCases.sendPsbt('account-id', mockPsbt, 'metamask'),
      ).rejects.toBe(error);
    });

    it('propagates an error if update fails', async () => {
      const error = new Error('update failed');
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockRepository.update.mockRejectedValue(error);

      await expect(
        useCases.sendPsbt('account-id', mockPsbt, 'metamask'),
      ).rejects.toBe(error);
    });
  });

  describe('fillAndSendPsbt', () => {
    const mockTxid = mock<Txid>();
    const mockOutput = mock<TxOut>({
      script_pubkey: mock<ScriptBuf>(),
      value: mock<Amount>(),
    });
    const mockTemplatePsbt = mock<Psbt>({
      unsigned_tx: {
        output: [mockOutput],
      },
      toString: () => 'base64Psbt',
    });
    const mockTransaction = mock<Transaction>({
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      compute_txid: jest.fn(),
      clone: jest.fn(),
    });
    const mockAccount = mock<BitcoinAccount>({
      network: 'bitcoin',
      sign: jest.fn(),
      isMine: () => false,
    });
    const mockWalletTx = mock<WalletTx>();
    const mockFeeRate = 3;
    const mockFrozenUTXOs = ['utxo1', 'utxo2'];
    const mockFilledPsbt = mock<Psbt>();
    const mockTxBuilder = mock<TransactionBuilder>({
      addRecipientByScript: jest.fn(),
      feeRate: jest.fn(),
      drainToByScript: jest.fn(),
      drainWallet: jest.fn(),
      finish: jest.fn(),
      unspendable: jest.fn(),
    });

    beforeEach(() => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockRepository.getFrozenUTXOs.mockResolvedValue(mockFrozenUTXOs);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);
      mockTransaction.clone.mockReturnThis();
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.addRecipientByScript.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainToByScript.mockReturnThis();
      mockTxBuilder.untouchedOrdering.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockFilledPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
    });

    it('throws error if account is not found', async () => {
      mockRepository.getWithSigner.mockResolvedValue(null);

      await expect(
        useCases.fillAndSendPsbt(
          'non-existent-id',
          mockTemplatePsbt,
          mockFeeRate,
          'metamask',
        ),
      ).rejects.toThrow('Account not found');
    });

    it('fills PSBT without change output, signs and sends transaction', async () => {
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const txId = await useCases.fillAndSendPsbt(
        'account-id',
        mockTemplatePsbt,
        mockFeeRate,
        'metamask',
      );

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');

      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith(mockFrozenUTXOs);
      expect(mockTxBuilder.addRecipientByScript).toHaveBeenCalledWith(
        mockOutput.value,
        mockOutput.script_pubkey,
      );
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(mockFeeRate);
      expect(mockTxBuilder.untouchedOrdering).toHaveBeenCalled();
      expect(mockTxBuilder.finish).toHaveBeenCalled();

      expect(mockAccount.sign).toHaveBeenCalledWith(mockFilledPsbt);
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
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionSubmitted,
        mockAccount,
        mockWalletTx,
        'metamask',
      );
      expect(txId).toBe(mockTxid);
    });

    it('fills PSBT with change output, signs and sends transaction', async () => {
      mockRepository.getWithSigner.mockResolvedValueOnce({
        ...mockAccount,
        isMine: () => true,
      });
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const txId = await useCases.fillAndSendPsbt(
        'account-id',
        mockTemplatePsbt,
        mockFeeRate,
        'metamask',
      );

      expect(mockTxBuilder.drainToByScript).toHaveBeenCalledWith(
        mockOutput.script_pubkey,
      );
      expect(txId).toBe(mockTxid);
    });

    it('propagates an error if getWithSigner fails', async () => {
      const error = new Error('getWithSigner failed');
      mockRepository.getWithSigner.mockRejectedValueOnce(error);

      await expect(
        useCases.fillAndSendPsbt(
          'account-id',
          mockTemplatePsbt,
          mockFeeRate,
          'metamask',
        ),
      ).rejects.toBe(error);
    });

    it('throws ValidationError if tx building fails', async () => {
      const error = new Error('builder error');
      mockTxBuilder.finish.mockImplementation(() => {
        throw error;
      });

      await expect(
        useCases.fillAndSendPsbt(
          'account-id',
          mockTemplatePsbt,
          mockFeeRate,
          'metamask',
        ),
      ).rejects.toThrow(
        new ValidationError(
          'Failed to build PSBT from template',
          {
            id: 'account-id',
            templatePsbt: 'base64Psbt',
            feeRate: mockFeeRate,
          },
          error,
        ),
      );
    });

    it('propagates an error if broadcast fails', async () => {
      const error = new Error('broadcast failed');
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockChain.broadcast.mockRejectedValueOnce(error);

      await expect(
        useCases.fillAndSendPsbt(
          'account-id',
          mockTemplatePsbt,
          mockFeeRate,
          'metamask',
        ),
      ).rejects.toBe(error);
    });

    it('propagates an error if update fails', async () => {
      const error = new Error('update failed');
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockRepository.update.mockRejectedValue(error);

      await expect(
        useCases.fillAndSendPsbt(
          'account-id',
          mockTemplatePsbt,
          mockFeeRate,
          'metamask',
        ),
      ).rejects.toBe(error);
    });
  });
});
