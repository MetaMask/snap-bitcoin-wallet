import {
  DisconnectedError,
  InternalError,
  InvalidInputError,
  InvalidParamsError,
  MethodNotFoundError,
  ResourceNotFoundError,
  UnauthorizedError,
  UserRejectedRequestError,
  SnapError,
} from '@metamask/snaps-sdk';
import { StructError } from 'superstruct';

import type { Translator, Logger, SnapClient } from '../entities';
import {
  BaseError,
  ExternalServiceError,
  FormatError,
  InexistentMethodError,
  NotFoundError,
  PermissionError,
  StorageError,
  UserActionError,
  ValidationError,
  WalletError,
  AssertionError,
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
        this.#logger.error(error, error.data);

        try {
          await this.#snapClient.emitTrackingError(error);
        } catch (trackingError) {
          // The tracking pipeline is non‑critical; log and proceed so we don’t mask the original failure.
          this.#logger.error('Failed to track error', trackingError);
        }

        const errMsg =
          messages[`error.${error.code}`]?.message ??
          messages['error.internal']?.message ??
          'Internal error';

        /* eslint-disable @typescript-eslint/only-throw-error */
        // User errors that he can rectify: Equivalent to 4xx errors
        if (error instanceof FormatError) {
          throw new InvalidInputError(
            `${errMsg}: ${error.message}`,
            error.data,
          );
        } else if (error instanceof ValidationError) {
          throw new InvalidParamsError(
            `${errMsg}: ${error.message}`,
            error.data,
          );
        } else if (error instanceof NotFoundError) {
          throw new ResourceNotFoundError(
            `${errMsg}: ${error.message}`,
            error.data,
          );
        } else if (error instanceof InexistentMethodError) {
          throw new MethodNotFoundError(
            `${errMsg}: ${error.message}`,
            error.data,
          );
        } else if (error instanceof PermissionError) {
          throw new UnauthorizedError(
            `${errMsg}: ${error.message}`,
            error.data,
          );
        } else if (error instanceof UserActionError) {
          throw new UserRejectedRequestError(
            `${errMsg}: ${error.message}`,
            error.data,
          );

          // Internal errors that we should not expose to the user: Equivalent to 5xx errors
        } else if (error instanceof ExternalServiceError) {
          throw new DisconnectedError(errMsg, error.data);
        } else if (
          error instanceof WalletError ||
          error instanceof StorageError ||
          error instanceof AssertionError
        ) {
          throw new InternalError(errMsg, error.data);
        } else {
          throw new InternalError(errMsg, error.data);
        }
      } else {
        if (error instanceof StructError) {
          const errMsg = messages['error.0']?.message ?? 'Invalid format';
          throw new InvalidInputError(
            `${errMsg}: ${error.message}`,
            error.data,
          );
        }
        // Unknown error type — wrap in SnapError to preserve the original
        // error's message and class info for observability (previously this
        // branch replaced everything with a generic "Unexpected error"
        // string, making cross-boundary errors like KeyringControllerError
        // opaque in Sentry).
        this.#logger.error(error);
        throw new SnapError(error instanceof Error ? error : String(error));
      }
    }
  }
}
