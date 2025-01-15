import type { AddressType, Network } from 'bitcoindevkit';

import type {
  AccountsConfig,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
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
  readonly #repository: BitcoinAccountRepository;

  readonly #chain: BlockchainClient;

  readonly #accountConfig: AccountsConfig;

  constructor(
    repository: BitcoinAccountRepository,
    chain: BlockchainClient,
    accountConfig: AccountsConfig,
  ) {
    this.#repository = repository;
    this.#chain = chain;
    this.#accountConfig = accountConfig;
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
    addressType: AddressType,
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
      logger.warn('Bitcoin account already exists: %s', account.id);
      return account;
    }

    const newAccount = await this.#repository.insert(
      derivationPath,
      network,
      addressType,
    );

    logger.info(
      'Bitcoin account created successfully: %s. derivationPath: %s',
      newAccount.id,
      derivationPath.join('/'),
    );
    return newAccount;
  }

  /**
   * Synchronize an account with the blockchain and update its state.
   * @param id - The account id.
   * @returns The updated account.
   */
  async synchronize(id: string): Promise<BitcoinAccount> {
    logger.debug('Synchronizing account. ID: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    // If the account is already scanned, we just sync it, otherwise we do a full scan.
    if (account.isScanned) {
      await this.#chain.sync(account);
    } else {
      logger.info('Performing initial full scan: %s', account.id);
      await this.#chain.fullScan(account);
    }

    await this.#repository.update(account);

    logger.info('Account synchronized successfully: %s', account.id);
    return account;
  }

  async delete(id: string): Promise<void> {
    logger.debug('Deleting account. ID: %s', id);

    const account = await this.#repository.get(id);
    if (!account) {
      return;
    }

    if (
      account.addressType === this.#accountConfig.defaultAddressType &&
      account.network === this.#accountConfig.defaultNetwork
    ) {
      throw new Error('Default Bitcoin account cannot be removed');
    }

    await this.#repository.delete(id);

    logger.info('Account deleted successfully: %s', account.id);
  }
}
