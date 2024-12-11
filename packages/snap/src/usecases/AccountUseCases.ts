import { AddressType, Network } from 'bdk_wasm';

import type { BitcoinAccount } from '../entities';
import type { AccountRepository } from '../store';
import { logger } from '../utils';

const addressTypeToPurpose = {
  [AddressType.P2pkh]: "44'",
  [AddressType.P2sh]: "49'",
  [AddressType.P2wpkh]: "84'",
  [AddressType.P2tr]: "86'",
};

const networkToCoinType = {
  [Network.Bitcoin]: "0'",
  [Network.Testnet]: "1'",
  [Network.Testnet4]: "1'",
  [Network.Signet]: "1'",
  [Network.Regtest]: "1'",
};

export class AccountUseCases {
  protected readonly _repository: AccountRepository;

  protected readonly _accountIndex: number;

  constructor(repository: AccountRepository, accountIndex: number) {
    this._repository = repository;
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
}
