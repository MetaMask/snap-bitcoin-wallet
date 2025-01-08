import type { AddressType, Network } from 'bitcoindevkit';

import type { BitcoinAccount, BitcoinAccountRepository } from '../entities';
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
  protected readonly _repository: BitcoinAccountRepository;

  protected readonly _accountIndex: number;

  constructor(repository: BitcoinAccountRepository, accountIndex: number) {
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

    logger.info(
      'Bitcoin account created successfully: %s. derivationPath: %s',
      newAccount.id,
      derivationPath.join('/'),
    );
    return newAccount;
  }
}
