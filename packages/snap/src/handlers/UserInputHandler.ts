import type {
  InputChangeEvent,
  Json,
  UserInputEvent,
} from '@metamask/snaps-sdk';

import type { ReviewTransactionContext, SendFormContext } from '../entities';
import {
  ConfirmationEvent,
  FormatError,
  InexistentMethodError,
  ReviewTransactionEvent,
  SendFormEvent,
} from '../entities';
import type { ConfirmationUseCases, SendFlowUseCases } from '../use-cases';

export class UserInputHandler {
  readonly #sendFlowUseCases: SendFlowUseCases;

  readonly #confirmationUseCases: ConfirmationUseCases;

  constructor(sendFlow: SendFlowUseCases, confirmation: ConfirmationUseCases) {
    this.#sendFlowUseCases = sendFlow;
    this.#confirmationUseCases = confirmation;
  }

  async route(
    interfaceId: string,
    event: UserInputEvent,
    context: Record<string, Json> | null,
  ): Promise<void> {
    if (!context) {
      throw new FormatError('Missing context');
    }
    if (!event.name) {
      throw new FormatError('Missing event name');
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
    } else if (this.#isConfirmationEvent(event.name)) {
      return this.#confirmationUseCases.onChange(interfaceId, event.name);
    }

    throw new InexistentMethodError(`Unsupported event: ${event.name}`);
  }

  #isSendFormEvent(name: string): name is SendFormEvent {
    return Object.values(SendFormEvent).includes(name as SendFormEvent);
  }

  #isReviewTransactionEvent(name: string): name is ReviewTransactionEvent {
    return Object.values(ReviewTransactionEvent).includes(
      name as ReviewTransactionEvent,
    );
  }

  #isConfirmationEvent(name: string): name is ConfirmationEvent {
    return Object.values(ConfirmationEvent).includes(name as ConfirmationEvent);
  }

  #hasValue(event: UserInputEvent): event is InputChangeEvent {
    return 'value' in event;
  }
}
