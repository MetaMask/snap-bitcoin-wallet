import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { assert, enums } from 'superstruct';

import type { SendFormContext, UIContext } from '../entities';
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
    context: UIContext | null,
  ): Promise<void> {
    switch (event.type) {
      case UserInputEventType.InputChangeEvent:
      case UserInputEventType.ButtonClickEvent: {
        assert(event.name, enums(Object.values(SendFormEvent)));
        if (!context) {
          throw new Error('Missing context');
        }

        return await this.#sendFormUseCases.update(
          interfaceId,
          event.name,
          context as SendFormContext,
        );
      }
      default:
        throw new Error('Unsupported event type');
    }
  }
}
