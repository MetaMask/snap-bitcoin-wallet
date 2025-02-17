import { Json } from '@metamask/utils';
import type { Address, Network } from 'bitcoindevkit';

export type Inscription = {
  id: string;
  number: number;
  contentLength: number;
  contentType: string;
  satNumber: number;
  satName: string;
  satRarity: string;
  protocolName?: string;
  protocolContent?: Json[];
  location: string;
  charms?: string[];
  imageOriginalUrl: string;
};

export type MetaProtocolsClient = {
  /**
   * Fetch the inscriptions of a list of addresses.
   * @param network - the network on which to fetch the assets.
   * @param addresses - the list of addresses to scan.
   * @returns the list of UTXOs containing inscriptions
   */
  fetchInscriptions(
    network: Network,
    addresses: Set<Address>,
  ): Promise<Inscription[]>;
};
