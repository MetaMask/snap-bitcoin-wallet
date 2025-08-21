import type {
  AddressType,
  Amount,
  Network,
  Psbt,
  Transaction,
  Txid,
  WalletTx,
} from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';

import {
  AccountCapability,
  addressTypeToPurpose,
  type BitcoinAccount,
  type BitcoinAccountRepository,
  type BlockchainClient,
  type Logger,
  type MetaProtocolsClient,
  networkToCoinType,
  NotFoundError,
  PermissionError,
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

  async fillPsbt(
    id: string,
    templatePsbt: Psbt,
    feeRate?: number,
  ): Promise<Psbt> {
    this.#logger.debug('Filling PSBT inputs: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }
    this.#checkCapability(account, AccountCapability.FillPsbt);

    const psbt = await this.#fillPsbt(account, templatePsbt, feeRate);

    this.#logger.info(
      'PSBT filled successfully: %s. Account: %s, Network: %s',
      account.id,
      account.network,
    );

    return psbt;
  }

  async signPsbt(
    id: string,
    psbt: Psbt,
    origin: string,
    options: { fill: boolean; broadcast: boolean },
    feeRate?: number,
  ): Promise<{ psbt: string; txid?: Txid }> {
    this.#logger.debug('Signing PSBT: %s', id, options);

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }
    this.#checkCapability(account, AccountCapability.SignPsbt);

    const psbtToSign = options.fill
      ? await this.#fillPsbt(account, psbt, feeRate)
      : psbt;
    const signedPsbt = account.sign(psbtToSign);

    if (options.broadcast) {
      const psbtString = signedPsbt.toString();
      const tx = account.extractTransaction(signedPsbt);
      const txid = await this.#broadcast(account, tx, origin);

      this.#logger.info(
        'Transaction sent successfully: %s. Account: %s, Network: %s, Options: %o',
        txid.toString(),
        account.id,
        account.network,
        options,
      );
      return { psbt: psbtString, txid };
    }

    this.#logger.info(
      'PSBT signed successfully. Account: %s, Network: %s, Options: %o',
      account.id,
      account.network,
      options,
    );
    return { psbt: signedPsbt.toString() };
  }

  async computeFee(
    id: string,
    templatePsbt: Psbt,
    feeRate?: number,
  ): Promise<Amount> {
    this.#logger.debug('Getting fee amount for Psbt for account id: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }
    this.#checkCapability(account, AccountCapability.ComputeFee);

    const psbt = await this.#fillPsbt(account, templatePsbt, feeRate);
    return psbt.fee();
  }

  async broadcastPsbt(id: string, psbt: Psbt, origin: string): Promise<Txid> {
    this.#logger.debug('Sending transaction: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }
    this.#checkCapability(account, AccountCapability.BroadcastPsbt);

    const tx = account.extractTransaction(psbt);
    const txid = await this.#broadcast(account, tx, origin);

    this.#logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txid,
      account.id,
      account.network,
    );

    return txid;
  }

  async sendTransfer(
    id: string,
    recipients: { address: string; amount: string }[],
    origin: string,
    feeRate?: number,
  ): Promise<Txid> {
    this.#logger.debug(
      'Transferring funds: %s. Recipients: %o',
      id,
      recipients,
    );

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new NotFoundError('Account not found', { id });
    }
    this.#checkCapability(account, AccountCapability.SendTransfer);

    // Create a template PSBT with the recipients as outputs
    let builder = account.buildTx();
    for (const { address, amount } of recipients) {
      builder = builder.addRecipient(amount, address);
    }
    const templatePsbt = builder.finish();

    // Complete the PSBT with the necessary inputs, fee rate, etc.
    const psbt = await this.#fillPsbt(account, templatePsbt, feeRate);
    const signedPsbt = account.sign(psbt);
    const tx = account.extractTransaction(signedPsbt);
    const txid = await this.#broadcast(account, tx, origin);

    this.#logger.info(
      'Funds transferred successfully: %s. Account: %s, Network: %s, Options: %o',
      txid.toString(),
      account.id,
      account.network,
    );
    return txid;
  }

  async #fillPsbt(
    account: BitcoinAccount,
    templatePsbt: Psbt,
    feeRate?: number,
  ): Promise<Psbt> {
    const frozenUTXOs = await this.#repository.getFrozenUTXOs(account.id);
    const feeEstimates = await this.#chain.getFeeEstimates(account.network);

    const feeRateToUse =
      feeRate ??
      feeEstimates.get(this.#targetBlocksConfirmation) ??
      this.#fallbackFeeRate;

    try {
      let builder = account
        .buildTx()
        .feeRate(feeRateToUse)
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
          feeRate: feeRateToUse,
        },
        error,
      );
    }
  }

  async #broadcast(
    account: BitcoinAccount,
    tx: Transaction,
    origin: string,
  ): Promise<Txid> {
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

  #checkCapability(
    account: BitcoinAccount,
    capability: AccountCapability,
  ): void {
    if (!account.capabilities.includes(capability)) {
      throw new PermissionError('Account missing given capability', {
        id: account.id,
        capability,
        capabilities: account.capabilities,
      });
    }
  }
}
