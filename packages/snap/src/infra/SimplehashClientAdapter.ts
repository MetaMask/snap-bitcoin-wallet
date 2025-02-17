import { Address, Network } from 'bitcoindevkit';
import type {
  Inscription,
  MetaProtocolsClient,
  SimplehashConfig,
} from '../entities';
import qs from 'qs';
import { Json } from '@metamask/utils';

type NFTResponse = {
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
      image_original_url: string;
    };
  }[];
};

export class SimplehashClientAdapter implements MetaProtocolsClient {
  readonly #endpoints: Record<Network, string | undefined>;

  readonly #apiKey: string;

  constructor(config: SimplehashConfig) {
    this.#endpoints = {
      bitcoin: config.url.bitcoin,
      testnet: config.url.bitcoin,
      testnet4: config.url.bitcoin,
      signet: config.url.bitcoin,
      regtest: config.url.bitcoin,
    };
    this.#apiKey = config.apiKey;
  }

  async fetchInscriptions(
    network: Network,
    addresses: Set<Address>,
  ): Promise<Inscription[]> {
    const endpoint = this.#endpoints[network];
    if (!endpoint) return [];

    const params = {
      chains: 'bitcoin',
      wallet_addresses: addresses,
      limit: 50,
    };
    const url = `${endpoint}/nfts/owners_v2?${qs.stringify(params, {
      arrayFormat: 'comma',
    })}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': this.#apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch inscriptions: ${response.statusText}`);
    }

    const data: NFTResponse = await response.json();

    return data.nfts.map((nft) => {
      const details = nft.extra_metadata.ordinal_details;
      return {
        id: details.inscription_id,
        number: details.inscription_number,
        contentLength: details.content_length,
        contentType: details.content_type,
        satNumber: details.sat_number,
        satName: details.sat_name,
        satRarity: details.sat_rarity,
        protocolName: details.protocol_name ?? undefined,
        protocolContent: details.protocol_content ?? undefined,
        location: details.location,
        charms: details.charms ?? undefined,
        imageOriginalUrl: nft.extra_metadata.image_original_url,
      };
    });
  }
}
