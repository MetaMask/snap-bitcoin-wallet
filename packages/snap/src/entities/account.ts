import type {
  AddressInfo,
  AddressType,
  Balance,
  ChangeSet,
  Network,
} from 'bitcoindevkit';

/**
 * A Bitcoin account.
 */
export type BitcoinAccount = {
  /**
   * The id of the account.
   */
  id: string;

  /**
   * The suggested name of the account.
   */
  suggestedName: string;

  /**
   * The balance of the account.
   */
  balance: Balance;

  /**
   * The address type of the account.
   */
  addressType: AddressType;

  /**
   * The network of the account.
   */
  network: Network;

  /**
   * Get an address at a given index.
   * @param index
   * @returns the address
   */
  peekAddress(index: number): AddressInfo;

  /**
   * Get the next unused address. This will reveal a new address if there is no unused address.
   * Note that the account needs to be persisted for this operation to be idempotent.
   * @returns the address
   */
  nextUnusedAddress(): AddressInfo;

  /**
   * Reveal the next address.
   * Note that the account needs to be persisted for this operation to be idempotent.
   * @returns the address
   */
  revealNextAddress(): AddressInfo;

  /**
   * Get the change set.
   * @returns the change set
   */
  takeStaged(): ChangeSet | undefined;
};

/**
 * BitcoinAccountRepository is a repository that manages Bitcoin accounts.
 */
export type BitcoinAccountRepository = {
  /**
   * Get an account by its id.
   * @param id
   * @returns the account or null if it does not exist
   */
  get(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get an account by its derivation path.
   * @param derivationPath
   * @returns the account or null if it does not exist
   */
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;

  /**
   * Insert a new account.
   * @param derivationPath
   * @param network
   * @param addressType
   * @returns the new account
   */
  insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;
};
