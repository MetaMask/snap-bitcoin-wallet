import { assert, enums, object } from 'superstruct';

import type { SendFormUseCases } from '../use-cases';
import { UserInputEvent, UserInputEventType } from '@metamask/snaps-sdk';
import { SendFormContext, SendFormEvent, UIContext } from '../entities';

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

        await this.#sendFormUseCases.update(
          interfaceId,
          event.name,
          context as SendFormContext,
        );
        break;
      }
      default:
        throw new Error('Unsupported event type');
    }
  }
}
