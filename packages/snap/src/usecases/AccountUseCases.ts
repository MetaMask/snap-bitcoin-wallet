import type { AddressType, Network } from 'bitcoindevkit';

import type { BitcoinAccount, BlockchainClient } from '../entities';
import { AccountNotFoundError } from '../exceptions';
import type { AccountRepository } from '../repositories';
import { logger } from '../utils';

const addressTypeToPurpose: Record<AddressType, string> = {
  p2pkh: "44'",
  p2sh: "45'",
  p2wsh: "49'",
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
  protected readonly _repository: AccountRepository;

  protected readonly _chain: BlockchainClient;

  protected readonly _accountIndex: number;

  constructor(
    repository: AccountRepository,
    chain: BlockchainClient,
    accountIndex: number,
  ) {
    this._repository = repository;
    this._chain = chain;
    this._accountIndex = accountIndex;
  }

  async createAccount(
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
      `${this._accountIndex}'`,
    ];

    // Idempotent account creation + ensures only one account per derivation path
    const account = await this._repository.getByDerivationPath(derivationPath);
    if (account) {
      logger.warn('Bitcoin account already exists: %s', account.id);
      return account;
    }

    const newAccount = await this._repository.insert(
      derivationPath,
      network,
      addressType,
    );

    logger.info('Bitcoin account created successfully: %s', newAccount.id);
    return newAccount;
  }

  async synchronize(id: string): Promise<BitcoinAccount> {
    logger.debug('Synchronizing account. ID: %s', id);

    const account = await this._repository.get(id);
    if (!account) {
      throw new AccountNotFoundError();
    }

    // If the account is already scanned, we just sync it, otherwise we do a full scan.
    if (account.isScanned) {
      await this._chain.sync(account);
    } else {
      logger.info('Performing initial full scan: %s', account.id);
      await this._chain.fullScan(account);
    }

    await this._repository.update(account);

    logger.info('Account synchronized successfully: %s', account.id);
    return account;
  }
}
