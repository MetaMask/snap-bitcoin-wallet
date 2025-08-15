import type {
  AddressType,
  Amount,
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
  NotFoundError,
  type SnapClient,
  TrackingSnapEvent,
  ValidationError,
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

  readonly #fallbackFeeRate: number;

  readonly #targetBlocksConfirmation: number;

  constructor(
    logger: Logger,
    snapClient: SnapClient,
    repository: BitcoinAccountRepository,
    chain: BlockchainClient,
    fallbackFeeRate: number,
    targetBlocksConfirmation: number,
    metaProtocols?: MetaProtocolsClient,
  ) {
    this.#logger = logger;
    this.#snapClient = snapClient;
    this.#repository = repository;
    this.#chain = chain;
    this.#fallbackFeeRate = fallbackFeeRate;
    this.#targetBlocksConfirmation = targetBlocksConfirmation;
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
      throw new NotFoundError('Account not found', { id });
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

  async synchronize(account: BitcoinAccount, origin: string): Promise<void> {
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

    const txsToNotify: WalletTx[] = [];

    for (const tx of txsAfterSync) {
      const prevTx = txMapBefore.get(tx.txid.toString());

      if (!prevTx) {
        txsToNotify.push(tx);

        await this.#snapClient.emitTrackingEvent(
          TrackingSnapEvent.TransactionReceived,
          account,
          tx,
          origin,
        );

        continue;
      }

      const prevConfirmed = prevTx.chain_position.is_confirmed;
      const currConfirmed = tx.chain_position.is_confirmed;

      const statusChanged =
        (prevConfirmed && !currConfirmed) || (!prevConfirmed && currConfirmed);

      if (statusChanged) {
        if (tx.chain_position.is_confirmed) {
          txsToNotify.push(tx);

          await this.#snapClient.emitTrackingEvent(
            TrackingSnapEvent.TransactionFinalized,
            account,
            tx,
            origin,
          );
        } else {
          // if the status was changed, and now it's NOT confirmed
          // it means the tx was reorged.
          txsToNotify.push(tx);

          await this.#snapClient.emitTrackingEvent(
            TrackingSnapEvent.TransactionReorged,
            account,
            tx,
            origin,
          );
        }
      }
    }

    if (txsToNotify.length > 0) {
      await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
      await this.#snapClient.emitAccountTransactionsUpdatedEvent(
        account,
        txsToNotify,
      );
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
      throw new NotFoundError('Account not found', { id });
    }

    await this.#snapClient.emitAccountDeletedEvent(id);
    await this.#repository.delete(id);

    this.#logger.info('Account deleted successfully: %s', account.id);
  }

  async sendPsbt(id: string, psbt: Psbt, origin: string): Promise<Txid> {
    this.#logger.debug('Sending transaction: %s', id);

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }

    const txid = await this.#signAndSendPsbt(account, psbt, origin);

    this.#logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txid,
      account.id,
      account.network,
    );

    return txid;
  }

  async fillAndSendPsbt(
    id: string,
    templatePsbt: Psbt,
    origin: string,
  ): Promise<Txid> {
    this.#logger.debug('Filling and sending transaction: %s', id);

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }

    const psbt = await this.#fillPsbt(account, templatePsbt);
    const txid = await this.#signAndSendPsbt(account, psbt, origin);

    this.#logger.info(
      'Transaction filled and sent successfully: %s. Account: %s, Network: %s',
      txid,
      account.id,
      account.network,
    );

    return txid;
  }

  async computeFee(id: string, templatePsbt: Psbt): Promise<Amount> {
    this.#logger.debug('Getting fee amount for Psbt for account id: %s', id);

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }

    const psbt = await this.#fillPsbt(account, templatePsbt);
    return psbt.fee();
  }

  async #fillPsbt(account: BitcoinAccount, templatePsbt: Psbt): Promise<Psbt> {
    const frozenUTXOs = await this.#repository.getFrozenUTXOs(account.id);
    const feeEstimates = await this.#chain.getFeeEstimates(account.network);
    const feeRate =
      feeEstimates.get(this.#targetBlocksConfirmation) ?? this.#fallbackFeeRate;

    try {
      let builder = account
        .buildTx()
        .feeRate(feeRate)
        .unspendable(frozenUTXOs)
        .untouchedOrdering(); // we need to strictly adhere to the template output order. Many protocols use the order (e.g: 1: deposit, 2: OP_RETURN, 3: change)

      for (const txout of templatePsbt.unsigned_tx.output) {
        // if the PSBT contains an output that is sending to ourselves, we change its value. If the PSBT contains no change outputs, one will automatically be added.
        if (account.isMine(txout.script_pubkey)) {
          builder = builder.drainToByScript(txout.script_pubkey);
        } else {
          builder = builder.addRecipientByScript(
            txout.value,
            txout.script_pubkey,
          );
        }
      }
      return builder.finish();
    } catch (error) {
      throw new ValidationError(
        'Failed to build PSBT from template',
        {
          id: account.id,
          templatePsbt: templatePsbt.toString(),
          feeRate,
        },
        error,
      );
    }
  }

  async #signAndSendPsbt(
    account: BitcoinAccount,
    psbt: Psbt,
    origin: string,
  ): Promise<Txid> {
    const tx = account.sign(psbt);
    const txid = tx.compute_txid();
    await this.#chain.broadcast(account.network, tx.clone());
    account.applyUnconfirmedTx(tx, getCurrentUnixTimestamp());
    await this.#repository.update(account);

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);

    const walletTx = account.getTransaction(txid.toString());
    if (walletTx) {
      // should always be true by assertion but needed for type checking
      await this.#snapClient.emitAccountTransactionsUpdatedEvent(account, [
        walletTx,
      ]);

      await this.#snapClient.emitTrackingEvent(
        TrackingSnapEvent.TransactionSubmitted,
        account,
        walletTx,
        origin,
      );
    }

    return txid;
  }
}
