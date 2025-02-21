import type { BitcoinAccount } from './account';

export type Inscription = {
  id: string;
  number: number;
  contentLength: number;
  contentType: string;
  satNumber: number;
  satRarity: string;
  location: string;
  imageUrl?: string;
};

export type MetaProtocolsClient = {
  /**
   * Fetch the inscriptions of an account.
   * @param account - the account to fetch assets from.
   * @returns the list of inscriptions
   */
  fetchInscriptions(account: BitcoinAccount): Promise<Inscription[]>;
};
