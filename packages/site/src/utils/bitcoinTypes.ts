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
