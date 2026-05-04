import type { KeyringRequest, KeyringResponse } from '@metamask/keyring-api';
import type { Json } from '@metamask/snaps-sdk';
import { assert } from 'superstruct';

import type { ConfirmationRepository } from '../entities';
import {
  AccountCapability,
  InexistentMethodError,
  NotFoundError,
} from '../entities';
import { mapToUtxo } from './mappings';
import { parsePsbt } from './parsers';
import {
  BroadcastPsbtRequest,
  ComputeFeeRequest,
  FillPsbtRequest,
  GetUtxoRequest,
  SendTransferRequest,
  SignMessageRequest,
  SignPsbtRequest,
} from './validation';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export type SignPsbtResponse = {
  psbt: string;
  txid: string | null;
};

export type ComputeFeeResponse = {
  // Fee in satoshis
  fee: string;
};

export type BroadcastPsbtResponse = {
  txid: string;
};

export type FillPsbtResponse = {
  psbt: string;
};

export type SignMessageResponse = {
  signature: string;
};

export class KeyringRequestHandler {
  readonly #accountsUseCases: AccountUseCases;

  readonly #confirmationRepository: ConfirmationRepository;

  constructor(
    accounts: AccountUseCases,
    confirmationRepository: ConfirmationRepository,
  ) {
    this.#accountsUseCases = accounts;
    this.#confirmationRepository = confirmationRepository;
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
      case AccountCapability.GetUtxo: {
        assert(params, GetUtxoRequest);
        return this.#getUtxo(account, params.outpoint);
      }
      case AccountCapability.ListUtxos: {
        return this.#listUtxos(account);
      }
      case AccountCapability.PublicDescriptor: {
        return this.#publicDescriptor(account);
      }
      case AccountCapability.SignMessage: {
        assert(params, SignMessageRequest);
        return this.#signMessage(account, params.message, origin);
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
    const psbt = parsePsbt(psbtBase64);
    const account = await this.#accountsUseCases.get(id);

    await this.#confirmationRepository.insertSignPsbt(
      account,
      psbt,
      origin,
      options,
    );

    // Creates a fresh PSBT from the original base64 because the original PSBT is mutated by the confirmation repository
    const { psbt: signedPsbt, txid } = await this.#accountsUseCases.signPsbt(
      id,
      parsePsbt(psbtBase64),
      origin,
      options,
      feeRate,
    );
    return this.#toKeyringResponse({
      psbt: signedPsbt.toString(),
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

  async #getUtxo(id: string, outpoint: string): Promise<KeyringResponse> {
    const account = await this.#accountsUseCases.get(id);
    const utxo = account.getUtxo(outpoint);
    if (!utxo) {
      throw new NotFoundError('UTXO not found', { id });
    }
    return this.#toKeyringResponse(mapToUtxo(utxo, account.network));
  }

  async #listUtxos(id: string): Promise<KeyringResponse> {
    const account = await this.#accountsUseCases.get(id);
    return this.#toKeyringResponse(
      account.listUnspent().map((utxo) => mapToUtxo(utxo, account.network)),
    );
  }

  async #publicDescriptor(id: string): Promise<KeyringResponse> {
    const account = await this.#accountsUseCases.get(id);
    return this.#toKeyringResponse(account.publicDescriptor);
  }

  async #signMessage(
    id: string,
    message: string,
    origin: string,
  ): Promise<KeyringResponse> {
    const signature = await this.#accountsUseCases.signMessage(
      id,
      message,
      origin,
    );
    return this.#toKeyringResponse({
      signature,
    } as SignMessageResponse);
  }

  #toKeyringResponse(result: Json): KeyringResponse {
    return {
      pending: false,
      result,
    };
  }
}
