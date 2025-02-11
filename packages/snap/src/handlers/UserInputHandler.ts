import type { Json, UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';

import type { SendFormContext } from '../entities';
import { SendFormEvent } from '../entities';
import type { SendFormUseCases } from '../use-cases';

export class UserInputHandler {
  readonly #sendFormUseCases: SendFormUseCases;

  constructor(sendForm: SendFormUseCases) {
    this.#sendFormUseCases = sendForm;
  }

  async route(
    interfaceId: string,
    event: UserInputEvent,
    context: Record<string, Json> | null,
  ): Promise<void> {
    if (!context) {
      throw new Error('Missing context');
    }

    switch (event.type) {
      case UserInputEventType.InputChangeEvent:
      case UserInputEventType.ButtonClickEvent: {
        return this.#sendFormUseCases.update(
          interfaceId,
          event.name as SendFormEvent,
          context as SendFormContext,
        );
      }
      default:
        throw new Error('Unsupported event type');
    }
  }
}
