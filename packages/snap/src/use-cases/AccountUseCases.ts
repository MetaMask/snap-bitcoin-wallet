import type {
  AddressType,
  Network,
  Psbt,
  Txid,
  WalletTx,
} from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';

import {
  addressTypeToPurpose,
  type BitcoinAccount,
  type BitcoinAccountRepository,
  type BlockchainClient,
  type Logger,
  type MetaProtocolsClient,
  networkToCoinType,
  type SnapClient,
  TrackingSnapEvent,
} from '../entities';

export type DiscoverAccountParams = {
  network: Network;
  index: number;
  entropySource: string;
  addressType: AddressType;
};

export type CreateAccountParams = DiscoverAccountParams & {
  synchronize: boolean;
  correlationId?: string;
  accountName?: string;
};

export class AccountUseCases {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  readonly #repository: BitcoinAccountRepository;

  readonly #chain: BlockchainClient;

  readonly #metaProtocols: MetaProtocolsClient | undefined;

  constructor(
    logger: Logger,
    snapClient: SnapClient,
    repository: BitcoinAccountRepository,
    chain: BlockchainClient,
    metaProtocols?: MetaProtocolsClient,
  ) {
    this.#logger = logger;
    this.#snapClient = snapClient;
    this.#repository = repository;
    this.#chain = chain;
    this.#metaProtocols = metaProtocols;
  }

  async list(): Promise<BitcoinAccount[]> {
    this.#logger.debug('Listing accounts');

    const accounts = await this.#repository.getAll();

    this.#logger.debug('Accounts listed successfully');
    return accounts;
  }

  async get(id: string): Promise<BitcoinAccount> {
    this.#logger.debug('Fetching account: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    this.#logger.debug('Account found: %s', account.id);
    return account;
  }

  async discover(req: DiscoverAccountParams): Promise<BitcoinAccount> {
    this.#logger.debug('Discovering Bitcoin account. Request: %o', req);

    const { addressType, index, network, entropySource } = req;

    const derivationPath = [
      entropySource,
      `${addressTypeToPurpose[addressType]}'`,
      `${networkToCoinType[network]}'`,
      `${index}'`,
    ];

    // Idempotent account creation + ensures only one account per derivation path
    const account = await this.#repository.getByDerivationPath(derivationPath);
    if (account && account.network === network) {
      this.#logger.debug('Account already exists: %s,', account.id);
      return account;
    }

    const newAccount = await this.#repository.create(
      derivationPath,
      network,
      addressType,
    );

    await this.#chain.fullScan(newAccount);

    this.#logger.info(
      'Bitcoin account discovered successfully. Request: %o',
      req,
    );
    return newAccount;
  }

  async create(req: CreateAccountParams): Promise<BitcoinAccount> {
    this.#logger.debug('Creating new Bitcoin account. Request: %o', req);

    const {
      addressType,
      index,
      network,
      entropySource,
      correlationId,
      accountName,
      synchronize,
    } = req;

    const derivationPath = [
      entropySource,
      `${addressTypeToPurpose[addressType]}'`,
      `${networkToCoinType[network]}'`,
      `${index}'`,
    ];

    // Idempotent account creation + ensures only one account per derivation path
    const account = await this.#repository.getByDerivationPath(derivationPath);
    if (account && account.network === network) {
      this.#logger.debug('Account already exists: %s,', account.id);
      await this.#snapClient.emitAccountCreatedEvent(
        account,
        correlationId,
        accountName,
      );

      return account;
    }

    const newAccount = await this.#repository.create(
      derivationPath,
      network,
      addressType,
    );

    newAccount.revealNextAddress();

    await this.#repository.insert(newAccount);

    // First notify the event has been created, then full scan.
    await this.#snapClient.emitAccountCreatedEvent(
      newAccount,
      correlationId,
      accountName,
    );

    if (synchronize) {
      await this.fullScan(newAccount);
    }

    this.#logger.info(
      'Bitcoin account created successfully: %s. Public address: %s, Request: %o',
      newAccount.id,
      newAccount.publicAddress,
      req,
    );
    return newAccount;
  }

  async synchronize(account: BitcoinAccount): Promise<void> {
    this.#logger.debug('Synchronizing account: %s', account.id);

    const txsBeforeSync = account.listTransactions();
    await this.#chain.sync(account);
    const txsAfterSync = account.listTransactions();

    // If new transactions appeared, fetch inscriptions; otherwise, just update.
    if (txsAfterSync.length > txsBeforeSync.length) {
      const inscriptions = this.#metaProtocols
        ? await this.#metaProtocols.fetchInscriptions(account)
        : [];
      await this.#repository.update(account, inscriptions);
    } else {
      await this.#repository.update(account);
    }

    // Create a map for quick lookup of transactions before sync
    const txMapBefore = new Map<string, WalletTx>();
    for (const tx of txsBeforeSync) {
      txMapBefore.set(tx.txid.toString(), tx);
    }

    const newTxs: WalletTx[] = [];
    const confirmedTxs: WalletTx[] = [];
    const reorgedTxs: WalletTx[] = [];

    for (const tx of txsAfterSync) {
      const prevTx = txMapBefore.get(tx.txid.toString());

      if (!prevTx) {
        newTxs.push(tx);
        continue;
      }

      const statusChanged =
        prevTx.chain_position.is_confirmed !== tx.chain_position.is_confirmed;

      if (statusChanged) {
        if (tx.chain_position.is_confirmed) {
          confirmedTxs.push(tx);
        } else {
          // if the status was changed, and now it's NOT confirmed
          // it means the tx was reorged.
          reorgedTxs.push(tx);
        }
      }
    }

    const txsToNotify = [...newTxs, ...confirmedTxs, ...reorgedTxs];

    if (txsToNotify.length > 0) {
      await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
      await this.#snapClient.emitAccountTransactionsUpdatedEvent(
        account,
        txsToNotify,
      );
    }

    for (const tx of confirmedTxs) {
      /* eslint-disable @typescript-eslint/naming-convention */
      await this.#snapClient.emitTrackingEvent(
        TrackingSnapEvent.TransactionFinalized,
        {
          origin: 'CronHandler',
          message: 'Snap transaction finalized',
          network: account.network,
          account_id: account.id,
          account_public_address: account.publicAddress.toString(),
          address_type: account.addressType.toString(),
          tx_id: tx.txid.toString(),
        },
      );
      /* eslint-enable @typescript-eslint/naming-convention */
    }
    this.#logger.debug('Account synchronized successfully: %s', account.id);
  }

  async fullScan(account: BitcoinAccount): Promise<void> {
    this.#logger.debug('Performing initial full scan: %s', account.id);

    await this.#chain.fullScan(account);

    const inscriptions = this.#metaProtocols
      ? await this.#metaProtocols.fetchInscriptions(account)
      : [];
    await this.#repository.update(account, inscriptions);

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
    await this.#snapClient.emitAccountTransactionsUpdatedEvent(
      account,
      account.listTransactions(),
    );

    this.#logger.info(
      'initial full scan performed successfully: %s',
      account.id,
    );
  }

  async delete(id: string): Promise<void> {
    this.#logger.debug('Deleting account: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    await this.#snapClient.emitAccountDeletedEvent(id);
    await this.#repository.delete(id);

    this.#logger.info('Account deleted successfully: %s', account.id);
  }

  async sendPsbt(id: string, psbt: Psbt, origin: string): Promise<Txid> {
    this.#logger.debug('Sending transaction: %s', id);

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    const tx = account.sign(psbt);
    const txId = tx.compute_txid();
    await this.#chain.broadcast(account.network, tx.clone());
    account.applyUnconfirmedTx(tx, getCurrentUnixTimestamp());
    await this.#repository.update(account);

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);

    const walletTx = account.getTransaction(txId.toString());
    if (walletTx) {
      // should always be true by assertion but needed for type checking
      await this.#snapClient.emitAccountTransactionsUpdatedEvent(account, [
        walletTx,
      ]);
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    await this.#snapClient.emitTrackingEvent(
      TrackingSnapEvent.TransactionSubmitted,
      {
        origin,
        message: 'Snap transaction submitted',
        network: account.network,
        account_id: account.id,
        account_public_address: account.publicAddress.toString(),
        address_type: account.addressType.toString(),
        tx_id: txId.toString(),
      },
    );
    /* eslint-enable @typescript-eslint/naming-convention */

    this.#logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txId,
      id,
      account.network,
    );

    return txId;
  }
}
