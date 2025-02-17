import type {
  AddressType,
  LocalOutput,
  Network,
  Outpoint,
  Txid,
} from 'bitcoindevkit';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  TransactionRequest,
  SnapClient,
  MetaProtocolsClient,
} from '../entities';
import { logger } from '../utils';

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

  async synchronizeAll(): Promise<void> {
    logger.trace('Synchronizing all accounts');

    // accounts cannot be empty by assertion.
    const accounts = await this.#repository.getAll();
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        if (account.isScanned) {
          await this.#synchronize(account);
        } else {
          await this.#fullScan(account);
        }
      }),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          `Account failed to sync. ID: %s. Error: %o`,
          accounts[index].id,
          result.reason,
        );
      }
    });

    logger.debug('Accounts synchronized successfully');
  }

  async #synchronize(account: BitcoinAccount): Promise<void> {
    logger.trace('Synchronizing account. ID: %s', account.id);

    await this.#chain.sync(account);
    await this.#repository.update(account);

    logger.debug('Account synchronized successfully: %s', account.id);
  }

  async #fullScan(account: BitcoinAccount): Promise<void> {
    logger.debug('Performing initial full scan: %s', account.id);
    await this.#chain.fullScan(account);

    const utxos = account.listUnspent();
    if (utxos.length > 0) {
      await this.#synchronizeAssets(account, utxos);
    }

    await this.#repository.update(account);

    logger.debug('initial full scan performed successfully: %s', account.id);
  }

  async #synchronizeAssets(
    account: BitcoinAccount,
    utxos: LocalOutput[],
  ): Promise<void> {
    logger.trace('Synchronizing assets: %s', account.id);

    const usedAddresses = new Set(
      utxos.map((utxo) => account.peekAddress(utxo.derivation_index)),
    );

    account.inscriptions = await this.#metaProtocols.fetchInscriptions(
      account.network,
      usedAddresses,
    );
  }

  async delete(id: string): Promise<void> {
    logger.debug('Deleting account. ID: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    if (
      account.addressType === this.#accountConfig.defaultAddressType &&
      account.network === this.#accountConfig.defaultNetwork
    ) {
      throw new Error('Default Bitcoin account cannot be removed');
    }

    await this.#snapClient.emitAccountDeletedEvent(id);
    await this.#repository.delete(id);

    logger.info('Account deleted successfully: %s', account.id);
  }

  async send(id: string, request: TransactionRequest): Promise<Txid> {
    logger.debug('Sending transaction. ID: %s. Request: %o', id, request);

    const account = await this.#repository.getWithSigner(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    const builder = account.buildTx().feeRate(request.feeRate);

    // If no amount is specified at this point, it is a drain transaction
    if (request.amount) {
      builder.addRecipient(request.amount, request.recipient);
    } else {
      builder.drainWallet().drainTo(request.recipient);
    }

    const psbt = builder.finish();
    const tx = account.sign(psbt);
    await this.#chain.broadcast(account.network, tx);
    await this.#repository.update(account);

    const txId = tx.compute_txid();
    logger.info(
      'Transaction sent successfully: %s. Account: %s, Network: %s',
      txId,
      id,
      account.network,
    );

    return txId;
  }
}
