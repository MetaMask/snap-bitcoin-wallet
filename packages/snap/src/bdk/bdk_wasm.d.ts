/* tslint:disable */
/* eslint-disable */
export class WalletWrapper {
  free(): void;
  /**
   * @param {string} network
   * @param {string} external_descriptor
   * @param {string} internal_descriptor
   * @param {string} esplora_url
   */
  constructor(network: string, external_descriptor: string, internal_descriptor: string, esplora_url: string);
  /**
   * @param {number} stop_gap
   * @returns {Promise<any>}
   */
  sync(stop_gap: number): Promise<any>;
  /**
   * @param {number} stop_gap
   * @returns {Promise<void>}
   */
  sync2(stop_gap: number): Promise<void>;
  /**
   * @returns {bigint}
   */
  balance(): bigint;
  /**
   * @returns {string}
   */
  get_new_address(): string;
  /**
   * @param {number} index
   * @returns {string}
   */
  peek_address(index: number): string;
}
