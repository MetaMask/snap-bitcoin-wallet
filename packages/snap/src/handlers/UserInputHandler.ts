import type { Json, UserInputEvent } from '@metamask/snaps-sdk';

import type { ReviewTransactionContext } from '../entities';
import {
  ReviewTransactionEvent,
  type SendFormContext,
  SendFormEvent,
} from '../entities';
import type { SendFlowUseCases } from '../use-cases';

export class UserInputHandler {
  readonly #sendFlowUseCases: SendFlowUseCases;

  constructor(sendFlow: SendFlowUseCases) {
    this.#sendFlowUseCases = sendFlow;
  }

  async route(
    interfaceId: string,
    event: UserInputEvent,
    context: Record<string, Json> | null,
  ): Promise<void> {
    if (!context) {
      throw new Error('Missing context');
    }

    if (!event.name) {
      throw new Error('Missing event name');
    }

    if (this.#isSendFormEvent(event.name)) {
      // Cast context to SendFormContext
      return this.#sendFlowUseCases.updateForm(
        interfaceId,
        event.name,
        context as SendFormContext,
      );
    } else if (this.#isReviewTransactionEvent(event.name)) {
      // Cast context to the appropriate type for review
      return this.#sendFlowUseCases.updateReview(
        interfaceId,
        event.name,
        context as ReviewTransactionContext,
      );
    }

    throw new Error(`Unsupported event: ${event.name}`);
  }

  #isSendFormEvent(name: string): name is SendFormEvent {
    return Object.values(SendFormEvent).includes(name as SendFormEvent);
  }

  #isReviewTransactionEvent(name: string): name is ReviewTransactionEvent {
    return Object.values(ReviewTransactionEvent).includes(
      name as ReviewTransactionEvent,
    );
  }
}
