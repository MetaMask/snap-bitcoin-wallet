import type { SnapClient, Logger } from '../entities';
import { UserActionError, ConfirmationEvent } from '../entities';

export class ConfirmationUseCases {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  constructor(logger: Logger, snapClient: SnapClient) {
    this.#logger = logger;
    this.#snapClient = snapClient;
  }

  async onChange(interfaceId: string, event: ConfirmationEvent): Promise<void> {
    this.#logger.debug(
      'Event triggered on confirmation: %s. Event: %s',
      interfaceId,
      event,
    );

    switch (event) {
      case ConfirmationEvent.Cancel: {
        return this.#snapClient.resolveInterface(interfaceId, false);
      }
      case ConfirmationEvent.Confirm: {
        return this.#snapClient.resolveInterface(interfaceId, true);
      }
      default:
        throw new UserActionError('Unrecognized confirmation event');
    }
  }
}
