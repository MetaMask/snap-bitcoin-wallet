import {
  DisconnectedError,
  InternalError,
  InvalidInputError,
  InvalidParamsError,
  MethodNotFoundError,
  ResourceNotFoundError,
  UnauthorizedError,
} from '@metamask/snaps-sdk';

import type { Translator, Logger, SnapClient } from '../entities';
import {
  BaseError,
  ExternalServiceError,
  FormatError,
  InexistentMethodError,
  NotFoundError,
  PermissionError,
  StorageError,
  ValidationError,
  WalletError,
} from '../entities';

export class HandlerMiddleware {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  readonly #translator: Translator;

  constructor(logger: Logger, snapClient: SnapClient, translator: Translator) {
    this.#logger = logger;
    this.#snapClient = snapClient;
    this.#translator = translator;
  }

  async handle<ResponseT>(fn: () => Promise<ResponseT>): Promise<ResponseT> {
    try {
      return await fn();
    } catch (error) {
      const { locale } = await this.#snapClient.getPreferences();
      const messages = await this.#translator.load(locale);

      if (error instanceof BaseError) {
        this.#logger.error(error);
        await this.#snapClient.emitTrackingError(error);

        const errMsg =
          messages[`error.${error.code}`]?.message ??
          messages['error.internal']?.message ??
          'Internal error';

        // User errors that he can rectify: Equivalent to 4xx errors
        /* eslint-disable @typescript-eslint/only-throw-error */
        if (error instanceof FormatError) {
          throw new InvalidInputError(errMsg, error.data);
        } else if (error instanceof ValidationError) {
          throw new InvalidParamsError(errMsg, error.data);
        } else if (error instanceof NotFoundError) {
          throw new ResourceNotFoundError(errMsg, error.data);
        } else if (error instanceof InexistentMethodError) {
          throw new MethodNotFoundError(errMsg, error.data);
        } else if (error instanceof PermissionError) {
          throw new UnauthorizedError(errMsg, error.data);

          // Internal errors that we should not expose to the user: Equivalent to 5xx errors
        } else if (error instanceof ExternalServiceError) {
          throw new DisconnectedError(errMsg);
        } else if (
          error instanceof WalletError ||
          error instanceof StorageError
        ) {
          throw new InternalError(errMsg);
        } else {
          throw new InternalError(errMsg);
        }
      } else {
        // this should never happen unless a BaseError is not thrown
        const errMsg = messages.unexpected?.message ?? 'Unexpected error';
        this.#logger.error(errMsg, error);
        throw new InternalError(errMsg);
      }
    }
  }
}
