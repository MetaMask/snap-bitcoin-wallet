import type {
  AddressType,
  Network,
  Psbt,
  Txid,
  WalletTx,
} from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
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

  readonly #metaProtocols: MetaProtocolsClient | undefined;

  readonly #accountConfig: AccountsConfig;

  constructor(
    logger: Logger,
    snapClient: SnapClient,
    repository: BitcoinAccountRepository,
    chain: BlockchainClient,
    accountConfig: AccountsConfig,
    metaProtocols?: MetaProtocolsClient,
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
    entropySource?: string,
    addressType: AddressType = this.#accountConfig.defaultAddressType,
    correlationId?: string,
  ): Promise<BitcoinAccount> {
    this.#logger.debug('Creating new Bitcoin account. Params: %o', {
      network,
      addressType,
      entropySource,
      correlationId,
    });

    const derivationPath = [
      entropySource ?? 'm',
      addressTypeToPurpose[addressType],
      networkToCoinType[network],
      `${this.#accountConfig.index}'`,
    ];

    // Idempotent account creation + ensures only one account per derivation path
    const account = await this.#repository.getByDerivationPath(derivationPath);
    if (account) {
      this.#logger.debug('Account already exists: %s,', account.id);
      await this.#snapClient.emitAccountCreatedEvent(account, correlationId);
      return account;
    }

    const newAccount = await this.#repository.insert(
      derivationPath,
      network,
      addressType,
    );

    await this.#snapClient.emitAccountCreatedEvent(newAccount, correlationId);

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

    const inscriptions = this.#metaProtocols
      ? await this.#metaProtocols.fetchInscriptions(account)
      : [];
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

  async sendPsbt(id: string, psbt: Psbt): Promise<Txid> {
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

    this.#logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txId,
      id,
      account.network,
    );

    return txId;
  }
}
