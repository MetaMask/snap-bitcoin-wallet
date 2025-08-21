import type { KeyringRequest, KeyringResponse } from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import {
  array,
  assert,
  boolean,
  number,
  object,
  optional,
  string,
} from 'superstruct';

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
  // Fee in satoshis
  fee: string;
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

export const SendTransferRequest = object({
  recipients: array(
    object({
      address: string(),
      amount: string(),
    }),
  ),
  feeRate: optional(number()),
});

export class KeyringRequestHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(request: KeyringRequest): Promise<KeyringResponse> {
    const { account, request: requestData, origin } = request;
    const { method, params } = requestData;

    switch (method as AccountCapability) {
      case AccountCapability.SignPsbt: {
        assert(params, SignPsbtRequest);
        const { psbt, feeRate, options } = params;
        return this.#signPsbt(account, psbt, origin, options, feeRate);
      }
      case AccountCapability.FillPsbt: {
        assert(params, FillPsbtRequest);
        return this.#fillPsbt(account, params.psbt, params.feeRate);
      }
      case AccountCapability.ComputeFee: {
        assert(params, ComputeFeeRequest);
        return this.#computeFee(account, params.psbt, params.feeRate);
      }
      case AccountCapability.BroadcastPsbt: {
        assert(params, BroadcastPsbtRequest);
        return this.#broadcastPsbt(account, params.psbt, origin);
      }
      case AccountCapability.SendTransfer: {
        assert(params, SendTransferRequest);
        return this.#sendTransfer(
          account,
          params.recipients,
          origin,
          params.feeRate,
        );
      }
      default: {
        throw new InexistentMethodError(
          'Unrecognized Bitcoin account capability',
          {
            account,
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
    } as SignPsbtResponse);
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
    } as FillPsbtResponse);
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
    } as ComputeFeeResponse);
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
    } as BroadcastPsbtResponse);
  }

  async #sendTransfer(
    id: string,
    recipients: { address: string; amount: string }[],
    origin: string,
    feeRate?: number,
  ): Promise<KeyringResponse> {
    const txid = await this.#accountsUseCases.sendTransfer(
      id,
      recipients,
      origin,
      feeRate,
    );
    return this.#toKeyringResponse({
      txid: txid.toString(),
    } as BroadcastPsbtResponse);
  }

  #toKeyringResponse(result: Json): KeyringResponse {
    return {
      pending: false,
      result,
    };
  }
}
