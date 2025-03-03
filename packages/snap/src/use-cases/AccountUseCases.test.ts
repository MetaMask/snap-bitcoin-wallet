import type { LocalOutput, Transaction, Txid } from 'bitcoindevkit';
import { type AddressType, type Network, type Psbt } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  Inscription,
  MetaProtocolsClient,
  SnapClient,
  TransactionRequest,
} from '../entities';
import type { ILogger } from '../infra/logger';
import { AccountUseCases } from './AccountUseCases';

jest.mock('../infra/logger', () => {
  return { logger: mock<ILogger>() };
});

describe('AccountUseCases', () => {
  let useCases: AccountUseCases;

  const mockSnapClient = mock<SnapClient>();
  const mockRepository = mock<BitcoinAccountRepository>();
  const mockChain = mock<BlockchainClient>();
  const mockMetaProtocols = mock<MetaProtocolsClient>();
  const accountsConfig: AccountsConfig = {
    index: 0,
    defaultAddressType: 'p2wpkh',
  };

  beforeEach(() => {
    useCases = new AccountUseCases(
      mockSnapClient,
      mockRepository,
      mockChain,
      mockMetaProtocols,
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
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();

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
    const mockAccount = mock<BitcoinAccount>({
      id: 'some-id',
      isScanned: true,
      listOutput: jest.fn(),
    });

    beforeEach(() => {
      mockAccount.listOutput.mockReturnValue([]);
    });

    it('does not sync if account is not scanned', async () => {
      mockAccount.listOutput.mockReturnValue([]);

      await useCases.synchronize({ ...mockAccount, isScanned: false });

      expect(mockChain.sync).not.toHaveBeenCalled();
      expect(mockAccount.listOutput).not.toHaveBeenCalled();
    });

    it('performs a regular sync', async () => {
      mockAccount.listOutput.mockReturnValue([]);

      await useCases.synchronize(mockAccount);

      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockAccount.listOutput).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
    });

    it('performs a regular sync with assets and balance update event', async () => {
      const mockInscriptions = mock<Inscription[]>();
      mockAccount.listOutput
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mock<LocalOutput>()]);
      mockMetaProtocols.fetchInscriptions.mockResolvedValue(mockInscriptions);

      await useCases.synchronize(mockAccount);

      expect(mockChain.sync).toHaveBeenCalledWith(mockAccount);
      expect(mockAccount.listOutput).toHaveBeenCalledTimes(2);
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
  });

  describe('fullScan', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'some-id',
      isScanned: false,
    });
    const mockInscriptions = mock<Inscription[]>();

    it('performs a full scan', async () => {
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

  describe('send', () => {
    const requestWithAmount: TransactionRequest = {
      amount: '1000',
      feeRate: 10,
      recipient: 'recipient-address',
    };
    const requestDrain: TransactionRequest = {
      feeRate: 10,
      recipient: 'recipient-address',
      drain: true,
    };

    const mockTxid = mock<Txid>();
    const mockOutPoint = 'txid:vout';
    const mockPsbt = mock<Psbt>();
    const mockTransaction = mock<Transaction>({
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      compute_txid: jest.fn(),
    });
    const mockTxBuilder = {
      addRecipient: jest.fn(),
      feeRate: jest.fn(),
      drainTo: jest.fn(),
      drainWallet: jest.fn(),
      finish: jest.fn(),
      unspendable: jest.fn(),
    };
    const mockAccount = mock<BitcoinAccount>({
      network: 'bitcoin',
      buildTx: jest.fn(),
      sign: jest.fn(),
    });

    beforeEach(() => {
      mockTxBuilder.addRecipient.mockReturnThis();
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.drainTo.mockReturnThis();
      mockTxBuilder.drainWallet.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockPsbt);
      mockTxBuilder.unspendable.mockReturnThis();
    });

    it('throws error if both drain and amount are specified', async () => {
      await expect(
        useCases.send('non-existent-id', { ...requestWithAmount, drain: true }),
      ).rejects.toThrow("Cannot specify both 'amount' and 'drain' options");
    });

    it('throws error if account is not found', async () => {
      mockRepository.getWithSigner.mockResolvedValue(null);

      await expect(
        useCases.send('non-existent-id', requestWithAmount),
      ).rejects.toThrow('Account not found: non-existent-id');
    });

    it('sends transaction', async () => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockRepository.getFrozenUTXOs.mockResolvedValue([mockOutPoint]);
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const txId = await useCases.send('account-id', requestWithAmount);

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockAccount.buildTx).toHaveBeenCalled();
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(
        requestWithAmount.feeRate,
      );
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        requestWithAmount.amount,
        requestWithAmount.recipient,
      );
      expect(mockRepository.getFrozenUTXOs).toHaveBeenCalledWith('account-id');
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith([mockOutPoint]);
      expect(mockAccount.sign).toHaveBeenCalledWith(mockPsbt);
      expect(mockChain.broadcast).toHaveBeenCalledWith(
        mockAccount.network,
        mockTransaction,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(mockTransaction.compute_txid).toHaveBeenCalled();
      expect(txId).toBe(mockTxid);
    });

    it('sends a drain transaction when amount is not provided', async () => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockRepository.getFrozenUTXOs.mockResolvedValue([mockOutPoint]);
      mockAccount.sign.mockReturnValue(mockTransaction);
      mockTransaction.compute_txid.mockReturnValue(mockTxid);

      const txId = await useCases.send('account-id', requestDrain);

      expect(mockRepository.getWithSigner).toHaveBeenCalledWith('account-id');
      expect(mockAccount.buildTx).toHaveBeenCalled();
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(requestDrain.feeRate);
      expect(mockTxBuilder.drainWallet).toHaveBeenCalled();
      expect(mockTxBuilder.drainTo).toHaveBeenCalledWith(
        requestDrain.recipient,
      );
      expect(mockRepository.getFrozenUTXOs).toHaveBeenCalledWith('account-id');
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith([mockOutPoint]);
      expect(mockAccount.sign).toHaveBeenCalledWith(mockPsbt);
      expect(mockChain.broadcast).toHaveBeenCalledWith(
        mockAccount.network,
        mockTransaction,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(mockAccount);
      expect(
        mockSnapClient.emitAccountBalancesUpdatedEvent,
      ).toHaveBeenCalledWith(mockAccount);
      expect(mockTransaction.compute_txid).toHaveBeenCalled();
      expect(txId).toBe(mockTxid);
    });

    it('propagates an error if getWithSigner fails', async () => {
      const error = new Error('getWithSigner failed');
      mockRepository.getWithSigner.mockRejectedValueOnce(error);

      await expect(useCases.send('account-id', requestWithAmount)).rejects.toBe(
        error,
      );
    });

    it('propagates an error if buildTx fails', async () => {
      const error = new Error('buildTx failed');
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockAccount.buildTx.mockImplementation(() => {
        throw error;
      });

      await expect(useCases.send('account-id', requestWithAmount)).rejects.toBe(
        error,
      );
    });

    it('propagates an error if broadcast fails', async () => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);

      const error = new Error('broadcast failed');
      mockChain.broadcast.mockRejectedValueOnce(error);

      await expect(useCases.send('account-id', requestWithAmount)).rejects.toBe(
        error,
      );
    });

    it('propagates an error if update fails', async () => {
      mockRepository.getWithSigner.mockResolvedValue(mockAccount);
      mockAccount.buildTx.mockReturnValue(mockTxBuilder);

      const error = new Error('update failed');
      mockRepository.update.mockRejectedValue(error);

      await expect(useCases.send('account-id', requestWithAmount)).rejects.toBe(
        error,
      );
    });
  });
});
