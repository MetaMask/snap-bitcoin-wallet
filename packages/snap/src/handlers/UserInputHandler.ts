import { Json } from '@metamask/utils';
import { SendFormUseCases } from '../use-cases';
import { assert, enums, object } from 'superstruct';
import { UserInputEvent, UserInputEventType } from '@metamask/snaps-sdk';
import { SendFormEvents } from '../entities';

const InputChangeRequest = object({
  name: enums(Object.values(SendFormEvents)),
});

const ButtonClickRequest = object({
  name: enums(Object.values(SendFormEvents)),
});

export class UserInputHandler {
  readonly #sendFormUseCases: SendFormUseCases;

  constructor(sendForm: SendFormUseCases) {
    this.#sendFormUseCases = sendForm;
  }

  async route(
    interfaceId: string,
    event: UserInputEvent,
    context?: Record<string, Json>,
  ): Promise<void> {
    switch (event.type) {
      case UserInputEventType.InputChangeEvent: {
        assert(event, InputChangeRequest);
        return await this.#sendFormUseCases.update(
          interfaceId,
          event.name,
          context,
        );
      }
      case UserInputEventType.ButtonClickEvent: {
        assert(event, InputChangeRequest);
        return await this.#sendFormUseCases.resolve(
          event.name as SendFormNames,
        );
      }
      default:
        throw new Error(`Event type not supported: ${event.type}`);
    }
  }
}
