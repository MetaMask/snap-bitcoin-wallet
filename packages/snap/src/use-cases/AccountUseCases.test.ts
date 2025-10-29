import type {
  FeeEstimates,
  TxOut,
  ScriptBuf,
  Amount,
  Transaction,
  Txid,
  WalletTx,
  AddressType,
  Network,
  Psbt,
  Address,
} from '@metamask/bitcoindevkit';
import type { JsonSLIP10Node } from '@metamask/key-tree';
import { mock } from 'jest-mock-extended';

import type {
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  ConfirmationRepository,
  Inscription,
  Logger,
  MetaProtocolsClient,
  SnapClient,
  TransactionBuilder,
} from '../entities';
import {
  AccountCapability,
  TrackingSnapEvent,
  ValidationError,
} from '../entities';
import type {
  CreateAccountParams,
  DiscoverAccountParams,
} from './AccountUseCases';
import { AccountUseCases } from './AccountUseCases';
import { CronMethod } from '../handlers/CronHandler';

describe('AccountUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockSnapClient = mock<SnapClient>();
  const mockRepository = mock<BitcoinAccountRepository>();
  const mockConfirmationRepository = mock<ConfirmationRepository>();
  const mockChain = mock<BlockchainClient>();
  const mockMetaProtocols = mock<MetaProtocolsClient>();
  const fallbackFeeRate = 5.0;
  const targetBlocksConfirmation = 3;

  const useCases = new AccountUseCases(
    mockLogger,
    mockSnapClient,
    mockRepository,
    mockConfirmationRepository,
    mockChain,
    fallbackFeeRate,
    targetBlocksConfirmation,
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
        expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalledWith({
          duration: 'PT1S',
          method: CronMethod.FullScanAccount,
          params: { accountId: mockAccount.id },
        });
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
        expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalledWith({
          duration: 'PT1S',
          method: CronMethod.FullScanAccount,
          params: { accountId: mockAccount.id },
        });
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

    it('propagates an error if scheduleBackgroundEvent throws', async () => {
      const error = new Error('scheduleBackgroundEvent failed');
      mockSnapClient.scheduleBackgroundEvent.mockRejectedValue(error);

      await expect(
        useCases.create({ ...createParams, synchronize: true }),
      ).rejects.toBe(error);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
      expect(mockSnapClient.scheduleBackgroundEvent).toHaveBeenCalled();
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
        mockConfirmationRepository,
        mockChain,
        fallbackFeeRate,
        targetBlocksConfirmation,
        undefined,
      );
      const mockTransaction = mock<WalletTx>();
      mockAccount.listTransactions
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockTransaction]);

      await testUseCases.synchronize(mockAccount, 'test');

      expect(mockMetaProtocols.fetchInscriptions).not.toHaveBeenCalled();
    });

    it('continues synchronization when tracking events fail', async () => {
      const mockTransaction = mock<WalletTx>();
      const mockInscriptions = mock<Inscription[]>();
      const trackingError = new Error('Tracking service unavailable');

      mockAccount.listTransactions
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockTransaction]);
      mockMetaProtocols.fetchInscriptions.mockResolvedValue(mockInscriptions);
      mockSnapClient.emitTrackingEvent.mockRejectedValue(trackingError);

      // should not throw despite tracking failure
      expect(await useCases.synchronize(mockAccount, 'test')).toBeUndefined();

      // core synchronization functionality should still work
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

      // tracking should have been attempted
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionReceived,
        mockAccount,
        mockTransaction,
        'test',
      );

      // error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track event',
        trackingError,
      );
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
        mockConfirmationRepository,
        mockChain,
        fallbackFeeRate,
        targetBlocksConfirmation,
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

  describe('signPsbt', () => {
    const mockTxid = mock<Txid>();
    const mockOutput = mock<TxOut>({
      script_pubkey: mock<ScriptBuf>(),
      value: mock<Amount>(),
    });
    const mockPsbt = mock<Psbt>({
      unsigned_tx: {
        output: [mockOutput],
      },
      toString,
    });
    const mockTransaction = mock<Transaction>({
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      compute_txid: jest.fn(),
      clone: jest.fn(),
    });
    const mockSignedPsbt = mock<Psbt>({
      toString: () => 'mockSignedPsbt',
    });
    const mockAccount = mock<BitcoinAccount>({
      network: 'bitcoin',
      sign: jest.fn(),
      capabilities: [AccountCapability.SignPsbt],
    });
    const mockWalletTx = mock<WalletTx>();
    const mockFeeRate = 3;
    const mockFeeEstimates = mock<FeeEstimates>({
      get: () => mockFeeRate,
    });
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
      mockTransaction.compute_txid.mockReturnValue(mockTxid);
      mockTransaction.clone.mockReturnThis();
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockAccount.sign.mockReturnValue(mockSignedPsbt);
      mockAccount.extractTransaction.mockReturnValue(mockTransaction);
      mockTxBuilder.addRecipientByScript.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainToByScript.mockReturnThis();
      mockTxBuilder.untouchedOrdering.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockFilledPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
    });

    it('throws error if account is not found', async () => {
      mockRepository.getWithSigner.mockResolvedValue(null);

      await expect(
        useCases.signPsbt('non-existent-id', mockPsbt, 'metamask', {
          fill: false,
          broadcast: false,
        }),
      ).rejects.toThrow('Account not found');
    });

    it('signs a PSBT', async () => {
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const { txid, psbt } = await useCases.signPsbt(
        'account-id',
        mockPsbt,
        'metamask',
        {
          fill: false,
          broadcast: false,
        },
      );

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockAccount.sign).toHaveBeenCalledWith(mockPsbt);
      expect(txid).toBeUndefined();
      expect(psbt).toBe('mockSignedPsbt');
    });

    it('signs and broadcasts a PSBT', async () => {
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const { txid, psbt } = await useCases.signPsbt(
        'account-id',
        mockPsbt,
        'metamask',
        {
          fill: false,
          broadcast: true,
        },
      );

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
      expect(txid).toBe(mockTxid);
      expect(psbt).toBe('mockSignedPsbt');
    });

    it('fills, signs and broadcasts a PSBT', async () => {
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const { psbt, txid } = await useCases.signPsbt(
        'account-id',
        mockPsbt,
        'metamask',
        {
          fill: true,
          broadcast: true,
        },
      );

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith(
        mockAccount.network,
      );
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
      expect(txid).toBe(mockTxid);
      expect(psbt).toBe('mockSignedPsbt');
    });

    it('propagates an error if getWithSigner fails', async () => {
      const error = new Error('getWithSigner failed');
      mockRepository.getWithSigner.mockRejectedValueOnce(error);

      await expect(
        useCases.signPsbt('account-id', mockPsbt, 'metamask', {
          fill: false,
          broadcast: false,
        }),
      ).rejects.toBe(error);
    });

    it('propagates an error if broadcast fails', async () => {
      const error = new Error('broadcast failed');
      mockChain.broadcast.mockRejectedValueOnce(error);

      await expect(
        useCases.signPsbt('account-id', mockPsbt, 'metamask', {
          fill: false,
          broadcast: true,
        }),
      ).rejects.toBe(error);
    });

    it('propagates an error if update fails', async () => {
      const error = new Error('update failed');
      mockRepository.update.mockRejectedValue(error);

      await expect(
        useCases.signPsbt('account-id', mockPsbt, 'metamask', {
          fill: false,
          broadcast: true,
        }),
      ).rejects.toBe(error);
    });

    it('continues transaction processing when tracking events fail', async () => {
      const trackingError = new Error('Tracking service unavailable');
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);
      mockSnapClient.emitTrackingEvent.mockRejectedValue(trackingError);

      // Should complete successfully despite tracking failure
      const { txid, psbt } = await useCases.signPsbt(
        'account-id',
        mockPsbt,
        'metamask',
        {
          fill: false,
          broadcast: true,
        },
      );

      // Core transaction functionality should work
      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockAccount.sign).toHaveBeenCalledWith(mockPsbt);
      expect(mockChain.broadcast).toHaveBeenCalledWith(
        mockAccount.network,
        mockTransaction,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountTransactionsUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount, [mockWalletTx]);

      // Tracking should have been attempted
      expect(mockSnapClient.emitTrackingEvent).toHaveBeenCalledWith(
        TrackingSnapEvent.TransactionSubmitted,
        mockAccount,
        mockWalletTx,
        'metamask',
      );

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track event',
        trackingError,
      );

      // Transaction should still be successful
      expect(txid).toBe(mockTxid);
      expect(psbt).toBe('mockSignedPsbt');
    });
  });

  describe('fillPsbt', () => {
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
    const mockAccount = mock<BitcoinAccount>({
      id: 'account-id',
      network: 'bitcoin',
      sign: jest.fn(),
      isMine: () => false,
      capabilities: [AccountCapability.FillPsbt],
    });
    const mockFeeRate = 3;
    const mockFeeEstimates = mock<FeeEstimates>({
      get: () => mockFeeRate,
    });
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
      mockRepository.get.mockResolvedValue(mockAccount);
      mockRepository.getFrozenUTXOs.mockResolvedValue(mockFrozenUTXOs);
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.addRecipientByScript.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainToByScript.mockReturnThis();
      mockTxBuilder.untouchedOrdering.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockFilledPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
    });

    it('throws error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(
        useCases.fillPsbt('non-existent-id', mockTemplatePsbt),
      ).rejects.toThrow('Account not found');
    });

    it('fills PSBT without change output', async () => {
      const psbt = await useCases.fillPsbt('account-id', mockTemplatePsbt);

      expect(mockRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockRepository.getFrozenUTXOs).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith(
        mockAccount.network,
      );
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith(mockFrozenUTXOs);
      expect(mockTxBuilder.addRecipientByScript).toHaveBeenCalledWith(
        mockOutput.value,
        mockOutput.script_pubkey,
      );
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(mockFeeRate);
      expect(mockTxBuilder.untouchedOrdering).toHaveBeenCalled();
      expect(mockTxBuilder.finish).toHaveBeenCalled();

      expect(psbt).toBe(mockFilledPsbt);
    });

    it('fills PSBT with change output', async () => {
      mockRepository.get.mockResolvedValueOnce({
        ...mockAccount,
        isMine: () => true,
      });

      const psbt = await useCases.fillPsbt('account-id', mockTemplatePsbt);

      expect(mockTxBuilder.drainToByScript).toHaveBeenCalledWith(
        mockOutput.script_pubkey,
      );
      expect(psbt).toBe(mockFilledPsbt);
    });

    it('propagates an error if get fails', async () => {
      const error = new Error('get failed');
      mockRepository.get.mockRejectedValueOnce(error);

      await expect(
        useCases.fillPsbt('account-id', mockTemplatePsbt),
      ).rejects.toBe(error);
    });

    it('throws ValidationError if tx building fails', async () => {
      const error = new Error('builder error');
      mockTxBuilder.finish.mockImplementation(() => {
        throw error;
      });

      await expect(
        useCases.fillPsbt('account-id', mockTemplatePsbt),
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
  });

  describe('computeFee', () => {
    const mockFee = mock<Amount>();
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
    const mockAccount = mock<BitcoinAccount>({
      id: 'account-id',
      network: 'bitcoin',
      isMine: () => false,
      capabilities: [AccountCapability.ComputeFee],
    });
    const mockFeeRate = 3;
    const mockFeeEstimates = mock<FeeEstimates>({
      get: () => mockFeeRate,
    });
    const mockFrozenUTXOs = ['utxo1', 'utxo2'];
    const mockFilledPsbt = mock<Psbt>();
    const mockTxBuilder = mock<TransactionBuilder>({
      addRecipientByScript: jest.fn(),
      feeRate: jest.fn(),
      drainToByScript: jest.fn(),
      finish: jest.fn(),
      unspendable: jest.fn(),
    });

    beforeEach(() => {
      mockRepository.get.mockResolvedValue(mockAccount);
      mockRepository.getFrozenUTXOs.mockResolvedValue(mockFrozenUTXOs);
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.addRecipientByScript.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainToByScript.mockReturnThis();
      mockTxBuilder.untouchedOrdering.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockFilledPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
      mockFilledPsbt.fee.mockReturnValue(mockFee);
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
    });

    it('throws error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(
        useCases.computeFee('account-id', mockTemplatePsbt),
      ).rejects.toThrow('Account not found');
    });

    it('computes fee for PSBT without change output', async () => {
      const fee = await useCases.computeFee('account-id', mockTemplatePsbt);

      expect(mockRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockRepository.getFrozenUTXOs).toHaveBeenCalledWith('account-id');
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith('bitcoin');
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith(mockFrozenUTXOs);
      expect(mockTxBuilder.addRecipientByScript).toHaveBeenCalledWith(
        mockOutput.value,
        mockOutput.script_pubkey,
      );
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(mockFeeRate);
      expect(mockTxBuilder.untouchedOrdering).toHaveBeenCalled();
      expect(mockTxBuilder.finish).toHaveBeenCalled();
      expect(fee).toBe(mockFee);
    });

    it('computes fee for PSBT with change output', async () => {
      mockRepository.get.mockResolvedValueOnce({
        ...mockAccount,
        isMine: () => true,
      });

      const fee = await useCases.computeFee('account-id', mockTemplatePsbt);

      expect(mockTxBuilder.drainToByScript).toHaveBeenCalledWith(
        mockOutput.script_pubkey,
      );
      expect(mockTxBuilder.addRecipientByScript).not.toHaveBeenCalled();
      expect(fee).toBe(mockFee);
    });

    it('uses fallback fee rate when estimate is not available', async () => {
      mockChain.getFeeEstimates.mockResolvedValueOnce({
        ...mockFeeEstimates,
        get: () => undefined,
      });

      await useCases.computeFee('account-id', mockTemplatePsbt);

      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(fallbackFeeRate);
    });
  });

  describe('sendTransfer', () => {
    const recipients = [
      {
        address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
        amount: '1000',
      },
      {
        address: 'bcrt1q4gfcga7jfjmm02zpvrh4ttc5k7lmnq2re52z2y',
        amount: '2000',
      },
    ];
    const mockTxid = mock<Txid>();
    const mockOutput = mock<TxOut>({
      script_pubkey: mock<ScriptBuf>(),
      value: mock<Amount>(),
    });
    const mockPsbt = mock<Psbt>({
      unsigned_tx: {
        output: [mockOutput],
      },
      toString,
    });
    const mockTransaction = mock<Transaction>({
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      compute_txid: jest.fn(),
      clone: jest.fn(),
    });
    const mockSignedPsbt = mock<Psbt>({
      toString: () => 'mockSignedPsbt',
    });
    const mockAccount = mock<BitcoinAccount>({
      network: 'bitcoin',
      sign: jest.fn(),
      capabilities: [AccountCapability.SendTransfer],
    });
    const mockWalletTx = mock<WalletTx>();
    const mockFeeRate = 3;
    const mockFeeEstimates = mock<FeeEstimates>({
      get: () => mockFeeRate,
    });
    const mockFilledPsbt = mock<Psbt>();
    const mockTxBuilder = mock<TransactionBuilder>({
      addRecipient: jest.fn(),
      addRecipientByScript: jest.fn(),
      feeRate: jest.fn(),
      drainToByScript: jest.fn(),
      drainWallet: jest.fn(),
      finish: jest.fn(),
      unspendable: jest.fn(),
    });

    beforeEach(() => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);
      mockTransaction.clone.mockReturnThis();
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockAccount.sign.mockReturnValue(mockSignedPsbt);
      mockAccount.extractTransaction.mockReturnValue(mockTransaction);
      mockTxBuilder.addRecipient.mockReturnThis();
      mockTxBuilder.addRecipientByScript.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainToByScript.mockReturnThis();
      mockTxBuilder.untouchedOrdering.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockFilledPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
      mockChain.getFeeEstimates.mockResolvedValue(mockFeeEstimates);
    });

    it('throws error if account is not found', async () => {
      mockRepository.getWithSigner.mockResolvedValue(null);

      await expect(
        useCases.sendTransfer('non-existent-id', recipients, 'metamask'),
      ).rejects.toThrow('Account not found');
    });

    it('sends funds', async () => {
      mockAccount.getTransaction.mockReturnValue(mockWalletTx);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);
      mockTxBuilder.finish.mockReturnValueOnce(mockPsbt);

      const txid = await useCases.sendTransfer(
        'account-id',
        recipients,
        'metamask',
      );

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        '1000',
        'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
      );
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        '2000',
        'bcrt1q4gfcga7jfjmm02zpvrh4ttc5k7lmnq2re52z2y',
      );
      expect(mockChain.getFeeEstimates).toHaveBeenCalledWith(
        mockAccount.network,
      );
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
      expect(txid).toBe(mockTxid);
    });

    it('propagates an error if getWithSigner fails', async () => {
      const error = new Error('getWithSigner failed');
      mockRepository.getWithSigner.mockRejectedValueOnce(error);

      await expect(
        useCases.sendTransfer('account-id', recipients, 'metamask'),
      ).rejects.toBe(error);
    });

    it('propagates an error if broadcast fails', async () => {
      const error = new Error('broadcast failed');
      mockChain.broadcast.mockRejectedValueOnce(error);
      mockTxBuilder.finish.mockReturnValueOnce(mockPsbt);

      await expect(
        useCases.sendTransfer('account-id', recipients, 'metamask'),
      ).rejects.toBe(error);
    });

    it('propagates an error if update fails', async () => {
      const error = new Error('update failed');
      mockRepository.update.mockRejectedValue(error);
      mockTxBuilder.finish.mockReturnValueOnce(mockPsbt);

      await expect(
        useCases.sendTransfer('account-id', recipients, 'metamask'),
      ).rejects.toBe(error);
    });
  });

  describe('signMessage', () => {
    const mockAccount = mock<BitcoinAccount>({
      publicAddress: mock<Address>({
        toString: () => 'bcrt1qs2fj7czz0amfm74j73yujx6dn6223md56gkkuy',
      }),
      capabilities: [AccountCapability.SignMessage],
      derivationPath: ['m', "84'", "0'"],
    });
    const mockMessage = 'Hello, world!';
    const mockOrigin = 'metamask';

    beforeEach(() => {
      mockRepository.get.mockResolvedValue(mockAccount);
      mockSnapClient.getPrivateEntropy.mockResolvedValue({
        privateKey:
          '0xdf23b869a1395aec3bf878797daac998ed4acf404fa26ff622eef7f30dc46791',
      } as JsonSLIP10Node);
    });

    it('throws error if account is not found', async () => {
      mockRepository.get.mockResolvedValue(null);

      await expect(
        useCases.signMessage('non-existent-id', mockMessage, mockOrigin),
      ).rejects.toThrow('Account not found');
    });

    it('signs a message', async () => {
      const expectedSignature =
        'AkcwRAIgZxodJQ60t9Rr/hABEHZ1zPUJ4m5hdM5QLpysH8fDSzgCIENOEuZtYf9/Nn/ZW15PcImkknol403dmZrgoOQ+6K+TASECwDKypXm/ElmVTxTLJ7nao6X5mB/iGbU2Q2qtot0QRL4=';

      const signature = await useCases.signMessage(
        'account-id',
        mockMessage,
        mockOrigin,
      );

      expect(mockRepository.get).toHaveBeenCalledWith('account-id');
      expect(mockSnapClient.getPrivateEntropy).toHaveBeenCalledWith([
        'm',
        "84'",
        "0'",
        '0',
        '0',
      ]);
      expect(mockConfirmationRepository.insertSignMessage).toHaveBeenCalledWith(
        mockAccount,
        mockMessage,
        mockOrigin,
      );
      expect(signature).toBe(expectedSignature);
    });

    it('throws WalletError if fails to sign message', async () => {
      mockSnapClient.getPrivateEntropy.mockResolvedValue({
        privateKey: '0x1234567890abcdef', // wrong private key returned
      } as JsonSLIP10Node);

      await expect(
        useCases.signMessage('account-id', mockMessage, mockOrigin),
      ).rejects.toThrow('Failed to sign message');
    });

    it('propagates an error if get fails', async () => {
      const error = new Error('get failed');
      mockRepository.get.mockRejectedValueOnce(error);

      await expect(
        useCases.signMessage('account-id', mockMessage, mockOrigin),
      ).rejects.toBe(error);
    });

    it('propagates an error if getPrivateEntropy fails', async () => {
      const error = new Error('getPrivateEntropy failed');
      mockSnapClient.getPrivateEntropy.mockRejectedValue(error);

      await expect(
        useCases.signMessage('account-id', mockMessage, mockOrigin),
      ).rejects.toBe(error);
    });
  });
});
