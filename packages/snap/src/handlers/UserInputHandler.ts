import type {
  InputChangeEvent,
  Json,
  UserInputEvent,
} from '@metamask/snaps-sdk';

import type { ReviewTransactionContext, SendFormContext } from '../entities';
import { ReviewTransactionEvent, SendFormEvent } from '../entities';
import type { SendFlowUseCases } from '../use-cases';
import type { HandlerMiddleware } from './HandlerMiddleware';

export class UserInputHandler {
  readonly #middleware: HandlerMiddleware;

  readonly #sendFlowUseCases: SendFlowUseCases;

  constructor(middleware: HandlerMiddleware, sendFlow: SendFlowUseCases) {
    this.#middleware = middleware;
    this.#sendFlowUseCases = sendFlow;
  }

  async route(
    interfaceId: string,
    event: UserInputEvent,
    context: Record<string, Json> | null,
  ): Promise<void> {
    return this.#middleware.handle(async () => {
      if (!context) {
        throw new Error('Missing context');
      }
      if (!event.name) {
        throw new Error('Missing event name');
      }

      if (this.#isSendFormEvent(event.name)) {
        return this.#sendFlowUseCases.onChangeForm(
          interfaceId,
          event.name,
          context as SendFormContext,
          this.#hasValue(event) ? event.value : undefined,
        );
      } else if (this.#isReviewTransactionEvent(event.name)) {
        return this.#sendFlowUseCases.onChangeReview(
          interfaceId,
          event.name,
          context as ReviewTransactionContext,
        );
      }

      throw new Error(`Unsupported event: ${event.name}`);
    });
  }

  #isSendFormEvent(name: string): name is SendFormEvent {
    return Object.values(SendFormEvent).includes(name as SendFormEvent);
  }

  #isReviewTransactionEvent(name: string): name is ReviewTransactionEvent {
    return Object.values(ReviewTransactionEvent).includes(
      name as ReviewTransactionEvent,
    );
  }

  #hasValue(event: UserInputEvent): event is InputChangeEvent {
    return 'value' in event;
  }
}
