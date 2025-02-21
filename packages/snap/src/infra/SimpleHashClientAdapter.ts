import type { Json } from '@metamask/utils';
import type { Network } from 'bitcoindevkit';
import qs from 'qs';

import type {
  BitcoinAccount,
  Inscription,
  MetaProtocolsClient,
  SimpleHashConfig as SimplehHashConfig,
} from '../entities';

/* eslint-disable @typescript-eslint/naming-convention */
type NFTResponse = {
  next_cursor: string;
  nfts: {
    extra_metadata: {
      ordinal_details: {
        inscription_id: string;
        inscription_number: number;
        content_length: number;
        content_type: string;
        sat_number: number;
        sat_name: string;
        sat_rarity: string;
        protocol_name: string | null;
        protocol_content: Json[] | null;
        location: string;
        charms: string[] | null;
      };
      image_original_url: string | null;
    };
  }[];
};

export class SimpleHashClientAdapter implements MetaProtocolsClient {
  readonly #endpoints: Record<Network, string | undefined>;

  readonly #apiKey: string | undefined;

  constructor(config: SimplehHashConfig) {
    this.#endpoints = {
      bitcoin: config.url.bitcoin,
      testnet: config.url.testnet,
      testnet4: config.url.testnet4,
      signet: config.url.signet,
      regtest: config.url.regtest,
    };
    this.#apiKey = config.apiKey;
  }

  async fetchInscriptions(account: BitcoinAccount): Promise<Inscription[]> {
    const endpoint = this.#endpoints[account.network];
    if (!endpoint) {
      return [];
    }

    const usedAddresses = new Set(
      account
        .listUnspent()
        .map((utxo) => account.peekAddress(utxo.derivation_index))
        .toString(),
    );

    if (usedAddresses.size === 0) {
      return [];
    }

    let cursor: string | undefined;
    const inscriptions: Inscription[] = [];
    const MAX_PAGES = 5;
    let pages = 0;

    do {
      pages++;
      if (pages > MAX_PAGES) {
        console.warn(`Maximum page limit reached (${MAX_PAGES}).`);
        break;
      }

      const params = {
        chains: 'bitcoin',
        wallet_addresses: Array.from(usedAddresses),
        limit: 50,
        cursor,
      };

      const url = `${endpoint}/nfts/owners_v2?${qs.stringify(params, {
        arrayFormat: 'comma',
      })}`;

      const headers = this.#apiKey ? { 'X-API-KEY': this.#apiKey } : undefined;
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch inscriptions: ${response.statusText}`);
      }

      const data: NFTResponse = await response.json();

      inscriptions.push(
        ...data.nfts.map((nft) => {
          const details = nft.extra_metadata.ordinal_details;
          return {
            id: details.inscription_id,
            number: details.inscription_number,
            contentLength: details.content_length,
            contentType: details.content_type,
            satNumber: details.sat_number,
            satRarity: details.sat_rarity,
            location: details.location,
            imageUrl: nft.extra_metadata.image_original_url ?? undefined,
          };
        }),
      );

      cursor = data.next_cursor;
    } while (cursor);

    return inscriptions;
  }
}