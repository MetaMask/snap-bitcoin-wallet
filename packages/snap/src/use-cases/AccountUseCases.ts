import type { AddressType, Network, Txid } from 'bitcoindevkit';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  TransactionRequest,
  SnapClient,
  MetaProtocolsClient,
} from '../entities';
import { logger } from '../infra/logger';

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
  readonly #snapClient: SnapClient;

  readonly #repository: BitcoinAccountRepository;

  readonly #chain: BlockchainClient;

  readonly #metaProtocols: MetaProtocolsClient;

  readonly #accountConfig: AccountsConfig;

  constructor(
    snapClient: SnapClient,
    repository: BitcoinAccountRepository,
    chain: BlockchainClient,
    metaProtocols: MetaProtocolsClient,
    accountConfig: AccountsConfig,
  ) {
    this.#snapClient = snapClient;
    this.#repository = repository;
    this.#chain = chain;
    this.#metaProtocols = metaProtocols;
    this.#accountConfig = accountConfig;
  }

  async list(): Promise<BitcoinAccount[]> {
    logger.trace('Listing accounts');

    const accounts = await this.#repository.getAll();

    logger.debug('Accounts listed successfully');
    return accounts;
  }

  async get(id: string): Promise<BitcoinAccount> {
    logger.trace('Fetching account. ID: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    logger.debug('Account found: %s', account.id);
    return account;
  }

  async create(
    network: Network,
    addressType: AddressType = this.#accountConfig.defaultAddressType,
  ): Promise<BitcoinAccount> {
    logger.debug(
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
      logger.debug('Account already exists. ID: %s,', account.id);
      await this.#snapClient.emitAccountCreatedEvent(account);
      return account;
    }

    const newAccount = await this.#repository.insert(
      derivationPath,
      network,
      addressType,
    );

    await this.#snapClient.emitAccountCreatedEvent(newAccount);

    logger.info(
      'Bitcoin account created successfully: %s. derivationPath: %s',
      newAccount.id,
      derivationPath.join('/'),
    );
    return newAccount;
  }

  async synchronize(account: BitcoinAccount): Promise<void> {
    logger.trace('Synchronizing account. ID: %s', account.id);

    if (!account.isScanned) {
      logger.warn(
        'Account has not yet performed initial full scan, skipping synchronization. ID: %s',
        account.id,
      );
      return;
    }

    // Transactions are monotone, meaning they can only be added, so we can be confident
    // that a change on the balance can only happen when new txs appear.
    const nTxsBefore = account.listTransactions().length;
    await this.#chain.sync(account);
    const nTxsAfter = account.listTransactions().length;

    if (nTxsBefore !== nTxsAfter) {
      const inscriptions = await this.#metaProtocols.fetchInscriptions(account);
      await this.#repository.update(account, inscriptions);

      await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
      await this.#snapClient.emitAccountTransactionsUpdatedEvent(account);
    } else {
      await this.#repository.update(account);
    }

    logger.debug('Account synchronized successfully: %s', account.id);
  }

  async fullScan(account: BitcoinAccount): Promise<void> {
    logger.debug('Performing initial full scan: %s', account.id);

    await this.#chain.fullScan(account);

    const inscriptions = await this.#metaProtocols.fetchInscriptions(account);
    await this.#repository.update(account, inscriptions);

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
    await this.#snapClient.emitAccountTransactionsUpdatedEvent(account);

    logger.debug('initial full scan performed successfully: %s', account.id);
  }

  async delete(id: string): Promise<void> {
    logger.debug('Deleting account. ID: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    await this.#snapClient.emitAccountDeletedEvent(id);
    await this.#repository.delete(id);

    logger.info('Account deleted successfully: %s', account.id);
  }

  async send(id: string, request: TransactionRequest): Promise<Txid> {
    logger.debug('Sending transaction. ID: %s. Request: %o', id, request);

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

    const txId = tx.compute_txid();

    await this.#snapClient.emitAccountBalancesUpdatedEvent(account);
    await this.#snapClient.emitAccountTransactionsUpdatedEvent(account);

    logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txId,
      id,
      account.network,
    );

    return txId;
  }
}
