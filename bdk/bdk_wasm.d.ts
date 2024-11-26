/* tslint:disable */
/* eslint-disable */
/**
 * @param {string} mnemonic
 * @param {string} passphrase
 * @param {Network} network
 * @param {AddressType} address_type
 * @returns {DescriptorPair}
 */
export function mnemonic_to_descriptor(mnemonic: string, passphrase: string, network: Network, address_type: AddressType): DescriptorPair;
/**
 * @param {string} extended_privkey
 * @param {string} fingerprint
 * @param {Network} network
 * @param {AddressType} address_type
 * @returns {DescriptorPair}
 */
export function xpriv_to_descriptor(extended_privkey: string, fingerprint: string, network: Network, address_type: AddressType): DescriptorPair;
/**
 * @param {string} extended_pubkey
 * @param {string} fingerprint
 * @param {Network} network
 * @param {AddressType} address_type
 * @returns {DescriptorPair}
 */
export function xpub_to_descriptor(extended_pubkey: string, fingerprint: string, network: Network, address_type: AddressType): DescriptorPair;
/**
 * @param {string} mnemonic
 * @param {string} passphrase
 * @param {Network} network
 * @returns {string}
 */
export function mnemonic_to_xpriv(mnemonic: string, passphrase: string, network: Network): string;
/**
 * @param {any} slip10
 * @param {Network} network
 * @returns {string}
 */
export function slip10_to_extended(slip10: any, network: Network): string;
/**
 * The different types of addresses.
 */
export enum AddressType {
  /**
   * Pay to pubkey hash.
   */
  P2pkh = 0,
  /**
   * Pay to script hash.
   */
  P2sh = 1,
  /**
   * Pay to witness pubkey hash.
   */
  P2wpkh = 2,
  /**
   * Pay to taproot.
   */
  P2tr = 3,
}
/**
 * Types of keychains
 */
export enum KeychainKind {
  /**
   * External keychain, used for deriving recipient addresses.
   */
  External = 0,
  /**
   * Internal keychain, used for deriving change addresses.
   */
  Internal = 1,
}
/**
 * The cryptocurrency network to act on.
 */
export enum Network {
  /**
   * Mainnet Bitcoin.
   */
  Bitcoin = 0,
  /**
   * Bitcoin's testnet network.
   */
  Testnet = 1,
  /**
   * Bitcoin's testnet4 network.
   */
  Testnet4 = 2,
  /**
   * Bitcoin's signet network.
   */
  Signet = 3,
  /**
   * Bitcoin's regtest network.
   */
  Regtest = 4,
}
/**
 * A derived address and the index it was found at.
 */
export class AddressInfo {
  free(): void;
  readonly address: string;
  readonly index: number;
  readonly keychain: KeychainKind;
}
/**
 * Pair of descriptors for external and internal keychains
 */
export class DescriptorPair {
  free(): void;
  /**
   * @param {string} external
   * @param {string} internal
   */
  constructor(external: string, internal: string);
  readonly external: string;
  readonly internal: string;
}
export class EsploraMMWallet {
  free(): void;
  /**
   * @param {Network} network
   * @param {string} external_descriptor
   * @param {string} internal_descriptor
   * @param {string} url
   * @returns {Promise<EsploraMMWallet>}
   */
  static new(network: Network, external_descriptor: string, internal_descriptor: string, url: string): Promise<EsploraMMWallet>;
  /**
   * @param {number} stop_gap
   * @param {number} parallel_requests
   * @returns {Promise<void>}
   */
  full_scan(stop_gap: number, parallel_requests: number): Promise<void>;
  /**
   * @param {number} parallel_requests
   * @returns {Promise<void>}
   */
  sync(parallel_requests: number): Promise<void>;
  /**
   * @returns {bigint}
   */
  balance(): bigint;
  /**
   * @param {KeychainKind} keychain
   * @returns {AddressInfo}
   */
  next_unused_address(keychain: KeychainKind): AddressInfo;
  /**
   * @param {KeychainKind} keychain
   * @param {number} index
   * @returns {AddressInfo}
   */
  peek_address(keychain: KeychainKind, index: number): AddressInfo;
  /**
   * @param {KeychainKind} keychain
   * @returns {AddressInfo}
   */
  reveal_next_address(keychain: KeychainKind): AddressInfo;
  /**
   * @param {KeychainKind} keychain
   * @returns {(AddressInfo)[]}
   */
  list_unused_addresses(keychain: KeychainKind): (AddressInfo)[];
  /**
   * @returns {any}
   */
  take_staged(): any;
  /**
   * @param {string} block_hash
   * @returns {Promise<any>}
   */
  get_block_by_hash(block_hash: string): Promise<any>;
  /**
   * @returns {Promise<boolean>}
   */
  persist(): Promise<boolean>;
}
export class EsploraWallet {
  free(): void;
  /**
   * @param {Network} network
   * @param {string} external_descriptor
   * @param {string} internal_descriptor
   * @param {string} url
   * @returns {EsploraWallet}
   */
  static from_descriptors(network: Network, external_descriptor: string, internal_descriptor: string, url: string): EsploraWallet;
  /**
   * @param {string} mnemonic
   * @param {string} passphrase
   * @param {Network} network
   * @param {AddressType} address_type
   * @param {string} url
   * @returns {EsploraWallet}
   */
  static from_mnemonic(mnemonic: string, passphrase: string, network: Network, address_type: AddressType, url: string): EsploraWallet;
  /**
   * @param {string} extended_privkey
   * @param {string} fingerprint
   * @param {Network} network
   * @param {AddressType} address_type
   * @param {string} url
   * @returns {EsploraWallet}
   */
  static from_xpriv(extended_privkey: string, fingerprint: string, network: Network, address_type: AddressType, url: string): EsploraWallet;
  /**
   * @param {string} extended_pubkey
   * @param {string} fingerprint
   * @param {Network} network
   * @param {AddressType} address_type
   * @param {string} url
   * @returns {EsploraWallet}
   */
  static from_xpub(extended_pubkey: string, fingerprint: string, network: Network, address_type: AddressType, url: string): EsploraWallet;
  /**
   * @param {any} changeset
   * @param {string} url
   * @returns {EsploraWallet}
   */
  static load(changeset: any, url: string): EsploraWallet;
  /**
   * @param {number} stop_gap
   * @param {number} parallel_requests
   * @returns {Promise<void>}
   */
  full_scan(stop_gap: number, parallel_requests: number): Promise<void>;
  /**
   * @param {number} parallel_requests
   * @returns {Promise<void>}
   */
  sync(parallel_requests: number): Promise<void>;
  /**
   * @returns {bigint}
   */
  balance(): bigint;
  /**
   * @param {KeychainKind} keychain
   * @returns {AddressInfo}
   */
  next_unused_address(keychain: KeychainKind): AddressInfo;
  /**
   * @param {KeychainKind} keychain
   * @param {number} index
   * @returns {AddressInfo}
   */
  peek_address(keychain: KeychainKind, index: number): AddressInfo;
  /**
   * @param {KeychainKind} keychain
   * @returns {AddressInfo}
   */
  reveal_next_address(keychain: KeychainKind): AddressInfo;
  /**
   * @param {KeychainKind} keychain
   * @param {number} index
   * @returns {(AddressInfo)[]}
   */
  reveal_addresses_to(keychain: KeychainKind, index: number): (AddressInfo)[];
  /**
   * @param {KeychainKind} keychain
   * @returns {(AddressInfo)[]}
   */
  list_unused_addresses(keychain: KeychainKind): (AddressInfo)[];
  /**
   * @returns {any[]}
   */
  list_unspent(): any[];
  /**
   * @returns {any[]}
   */
  transactions(): any[];
  /**
   * @returns {any}
   */
  take_staged(): any;
  /**
   * @param {string} block_hash
   * @returns {Promise<any>}
   */
  get_block_by_hash(block_hash: string): Promise<any>;
}
