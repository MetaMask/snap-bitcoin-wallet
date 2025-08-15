import { Psbt } from '@metamask/bitcoindevkit';
import type { KeyringRequest, KeyringResponse } from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import { assert, boolean, number, object, optional, string } from 'superstruct';

import {
  AccountCapability,
  InexistentMethodError,
  ValidationError,
} from '../entities';
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

export class KeyringRequestHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(request: KeyringRequest): Promise<KeyringResponse> {
    console.log('request', request);
    const { id, request: requestData, origin } = request;
    const { method, params } = requestData;

    const account = await this.#accountsUseCases.get(id);
    if (!account.capabilities.includes(method as AccountCapability)) {
      throw new ValidationError('Account does not have given capability', {
        id,
        capability: method,
        capabilities: account.capabilities,
      });
    }

    switch (method as AccountCapability) {
      case AccountCapability.SignPsbt: {
        assert(params, SignPsbtRequest);
        const psbt = Psbt.from_string(params.psbt);
        return this.#signPsbt(id, psbt, origin, params.options);
      }
      case AccountCapability.ComputeFee: {
        assert(params, ComputeFeeRequest);
        const psbt = Psbt.from_string(params.psbt);
        return this.#computeFee(id, psbt);
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
    psbt: Psbt,
    origin: string,
    options: { fill: boolean; broadcast: boolean },
  ): Promise<KeyringResponse> {
    const finalizedPsbt = await this.#accountsUseCases.signPsbt(
      id,
      psbt,
      origin,
      options,
    );
    return this.#toKeyringResponse({
      psbt: finalizedPsbt.psbt.toString(),
      txid: finalizedPsbt.txid?.toString() ?? null,
    });
  }

  async #computeFee(id: string, psbt: Psbt): Promise<KeyringResponse> {
    const fee = await this.#accountsUseCases.computeFee(id, psbt);
    return this.#toKeyringResponse({
      fee: fee.to_sat().toString(),
    });
  }

  #toKeyringResponse(result: Json): KeyringResponse {
    return {
      pending: false,
      result,
    };
  }
}
