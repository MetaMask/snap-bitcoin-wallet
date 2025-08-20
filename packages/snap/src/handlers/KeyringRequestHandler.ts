import type { KeyringRequest, KeyringResponse } from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import { assert, boolean, number, object, optional, string } from 'superstruct';

import { AccountCapability, InexistentMethodError } from '../entities';
import { parsePsbt } from './parsers';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export const SignPsbtRequest = object({
  psbt: string(),
  feeRate: optional(number()),
  options: object({
    fill: boolean(),
    broadcast: boolean(),
  }),
});

export type SignPsbtResponse = {
  psbt: string;
  txid: string | null;
};

export const ComputeFeeRequest = object({
  psbt: string(),
  feeRate: optional(number()),
});

export type ComputeFeeResponse = {
  fee: number;
};

export const BroadcastPsbtRequest = object({
  psbt: string(),
});

export type BroadcastPsbtResponse = {
  txid: string;
};

export const FillPsbtRequest = object({
  psbt: string(),
  feeRate: optional(number()),
});

export type FillPsbtResponse = {
  psbt: string;
};

export class KeyringRequestHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(request: KeyringRequest): Promise<KeyringResponse> {
    const { id, request: requestData, origin } = request;
    const { method, params } = requestData;

    switch (method as AccountCapability) {
      case AccountCapability.SignPsbt: {
        assert(params, SignPsbtRequest);
        const { psbt, feeRate, options } = params;
        return this.#signPsbt(id, psbt, origin, options, feeRate);
      }
      case AccountCapability.FillPsbt: {
        assert(params, ComputeFeeRequest);
        return this.#fillPsbt(id, params.psbt, params.feeRate);
      }
      case AccountCapability.ComputeFee: {
        assert(params, ComputeFeeRequest);
        return this.#computeFee(id, params.psbt, params.feeRate);
      }
      case AccountCapability.BroadcastPsbt: {
        assert(params, BroadcastPsbtRequest);
        return this.#broadcastPsbt(id, params.psbt, origin);
      }
      default: {
        throw new InexistentMethodError(
          'Unrecognized Bitcoin account capability',
          {
            id,
            method,
          },
        );
      }
    }
  }

  async #signPsbt(
    id: string,
    psbtBase64: string,
    origin: string,
    options: { fill: boolean; broadcast: boolean },
    feeRate?: number,
  ): Promise<KeyringResponse> {
    const { psbt, txid } = await this.#accountsUseCases.signPsbt(
      id,
      parsePsbt(psbtBase64),
      origin,
      options,
      feeRate,
    );
    return this.#toKeyringResponse({
      psbt: psbt.toString(),
      txid: txid?.toString() ?? null,
    });
  }

  async #fillPsbt(
    id: string,
    psbtBase64: string,
    feeRate?: number,
  ): Promise<KeyringResponse> {
    const psbt = await this.#accountsUseCases.fillPsbt(
      id,
      parsePsbt(psbtBase64),
      feeRate,
    );
    return this.#toKeyringResponse({
      psbt: psbt.toString(),
    });
  }

  async #computeFee(
    id: string,
    psbtBase64: string,
    feeRate?: number,
  ): Promise<KeyringResponse> {
    const fee = await this.#accountsUseCases.computeFee(
      id,
      parsePsbt(psbtBase64),
      feeRate,
    );
    return this.#toKeyringResponse({
      fee: fee.to_sat().toString(),
    });
  }

  async #broadcastPsbt(
    id: string,
    psbtBase64: string,
    origin: string,
  ): Promise<KeyringResponse> {
    const txid = await this.#accountsUseCases.broadcastPsbt(
      id,
      parsePsbt(psbtBase64),
      origin,
    );
    return this.#toKeyringResponse({
      txid: txid.toString(),
    });
  }

  #toKeyringResponse(result: Json): KeyringResponse {
    return {
      pending: false,
      result,
    };
  }
}
