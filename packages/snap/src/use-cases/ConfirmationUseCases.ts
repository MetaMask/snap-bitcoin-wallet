import type { SnapClient, Logger } from '../entities';
import { UserActionError, ConfirmationEvent } from '../entities';

export class ConfirmationUseCases {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  constructor(logger: Logger, snapClient: SnapClient) {
    this.#logger = logger;
    this.#snapClient = snapClient;
  }

  async onChange(id: string, event: ConfirmationEvent): Promise<void> {
    this.#logger.debug(
      'Event triggered on confirmation: %s. Event: %s',
      id,
      event,
    );

    switch (event) {
      case ConfirmationEvent.Cancel: {
        return this.#snapClient.resolveInterface(id, false);
      }
      case ConfirmationEvent.Confirm: {
        return this.#snapClient.resolveInterface(id, true);
      }
      default:
        throw new UserActionError('Unrecognized confirmation event');
    }
  }
}
