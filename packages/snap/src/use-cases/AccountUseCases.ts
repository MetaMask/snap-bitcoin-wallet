import type { AddressType, Network, Txid, WalletTx } from 'bitcoindevkit';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  TransactionRequest,
  SnapClient,
  MetaProtocolsClient,
  Logger,
} from '../entities';

const addressTypeToPurpose: Record<AddressType, string> = {
  p2pkh: "44'",
  p2sh: "49'",
  p2wsh: "45'",
  p2wpkh: "84'",
  p2tr: "86'",
};

const networkToCoinType: Record<Network, string> = {
  bitcoin: "0'",
  testnet: "1'",
  testnet4: "1'",
  signet: "1'",
  regtest: "1'",
};

export class AccountUseCases {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  readonly #repository: BitcoinAccountRepository;

  readonly #chain: BlockchainClient;

  readonly #metaProtocols: MetaProtocolsClient;

  readonly #accountConfig: AccountsConfig;

  constructor(
    logger: Logger,
    snapClient: SnapClient,
    repository: BitcoinAccountRepository,
    chain: BlockchainClient,
    metaProtocols: MetaProtocolsClient,
    accountConfig: AccountsConfig,
  ) {
    this.#logger = logger;
    this.#snapClient = snapClient;
    this.#repository = repository;
    this.#chain = chain;
    this.#metaProtocols = metaProtocols;
    this.#accountConfig = accountConfig;
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

  async create(
    network: Network,
    addressType: AddressType = this.#accountConfig.defaultAddressType,
  ): Promise<BitcoinAccount> {
    this.#logger.debug(
      'Creating new Bitcoin account. Network: %o. addressType: %o,',
      network,
      addressType,
    );

    const derivationPath = [
      'm',
      addressTypeToPurpose[addressType],
      networkToCoinType[network],
      `${this.#accountConfig.index}'`,
    ];

    // Idempotent account creation + ensures only one account per derivation path
    const account = await this.#repository.getByDerivationPath(derivationPath);
    if (account) {
      this.#logger.debug('Account already exists: %s,', account.id);
      await this.#snapClient.emitAccountCreatedEvent(account);
      return account;
    }

    const newAccount = await this.#repository.insert(
      derivationPath,
      network,
      addressType,
    );

    await this.#snapClient.emitAccountCreatedEvent(newAccount);

    this.#logger.info(
      'Bitcoin account created successfully: %s. derivationPath: %s',
      newAccount.id,
      derivationPath.join('/'),
    );
    return newAccount;
  }

  async synchronize(account: BitcoinAccount): Promise<void> {
    this.#logger.debug('Synchronizing account: %s', account.id);

    if (!account.isScanned) {
      this.#logger.debug(
        'Account has not yet performed initial full scan, skipping synchronization: %s',
        account.id,
      );
      return;
    }

    const txsBeforeSync = account.listTransactions();
    await this.#chain.sync(account);
    const txsAfterSync = account.listTransactions();

    // If new transactions appeared, fetch inscriptions; otherwise, just update.
    if (txsAfterSync.length > txsBeforeSync.length) {
      const inscriptions = await this.#metaProtocols.fetchInscriptions(account);
      await this.#repository.update(account, inscriptions);
    } else {
      await this.#repository.update(account);
    }

    // Create a map for quick lookup of transactions before sync
    const txMapBefore = new Map<string, WalletTx>();
    for (const tx of txsBeforeSync) {
      txMapBefore.set(tx.txid.toString(), tx);
    }

    // Identify transactions that are either new or whose confirmation status changed
    const txsToNotify = txsAfterSync.filter((tx) => {
      const prevTx = txMapBefore.get(tx.txid.toString());
      return (
        !prevTx ||
        prevTx.chain_position.is_confirmed !== tx.chain_position.is_confirmed
      );
    });

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

    const inscriptions = await this.#metaProtocols.fetchInscriptions(account);
    await this.#repository.update(account, inscriptions);

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
    await this.#snapClient.emitAccountTransactionsUpdatedEvent(
      account,
      account.listTransactions(),
    );

    this.#logger.debug(
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

  async send(id: string, request: TransactionRequest): Promise<Txid> {
    this.#logger.debug('Sending transaction: %s. Request: %o', id, request);

    if (request.drain && request.amount) {
      throw new Error("Cannot specify both 'amount' and 'drain' options");
    }

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    const builder = account.buildTx().feeRate(request.feeRate);

    if (request.amount) {
      builder.addRecipient(request.amount, request.recipient);
    } else if (request.drain) {
      builder.drainWallet().drainTo(request.recipient);
    } else {
      throw new Error("Either 'amount' or 'drain' must be specified");
    }

    // Make sure frozen UTXOs are not spent
    const frozenUTXOs = await this.#repository.getFrozenUTXOs(id);
    builder.unspendable(frozenUTXOs);

    const psbt = builder.finish();
    const tx = account.sign(psbt);
    await this.#chain.broadcast(account.network, tx);
    await this.#repository.update(account);

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);

    const txId = tx.compute_txid();
    this.#logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txId,
      id,
      account.network,
    );

    return txId;
  }
}
