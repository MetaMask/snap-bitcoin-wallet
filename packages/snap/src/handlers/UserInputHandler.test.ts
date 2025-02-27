import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { SendFormContext } from '../entities';
import { ReviewTransactionEvent, SendFormEvent } from '../entities';
import type { SendFlowUseCases } from '../use-cases';
import { UserInputHandler } from './UserInputHandler';

describe('UserInputHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockContext = mock<SendFormContext>();

  let handler: UserInputHandler;

  beforeEach(() => {
    handler = new UserInputHandler(mockSendFlowUseCases);
  });

  describe('route', () => {
    it('throws error if missing context', async () => {
      await expect(
        handler.route(
          'interface-id',
          { type: UserInputEventType.ButtonClickEvent } as UserInputEvent,
          null,
        ),
      ).rejects.toThrow('Missing context');
    });

    it('throws error if missing event name', async () => {
      await expect(
        handler.route(
          'interface-id',
          { type: UserInputEventType.ButtonClickEvent } as UserInputEvent,
          mockContext,
        ),
      ).rejects.toThrow('Missing event name');
    });

    it('throws on unsupported event', async () => {
      await expect(
        handler.route(
          'interface-id',
          {
            type: UserInputEventType.ButtonClickEvent,
            name: 'randomEvent',
          },
          mockContext,
        ),
      ).rejects.toThrow('Unsupported event: randomEvent');
    });
  });

  describe('update send form', () => {
    it('executes on supported event', async () => {
      await handler.route(
        'interface-id',
        {
          type: UserInputEventType.ButtonClickEvent,
          name: SendFormEvent.ClearRecipient,
        },
        mockContext,
      );

      expect(mockSendFlowUseCases.onFormInput).toHaveBeenCalledWith(
        'interface-id',
        SendFormEvent.ClearRecipient,
        mockContext,
      );
    });

    it('propagates errors from onFormInput', async () => {
      const error = new Error();
      mockSendFlowUseCases.onFormInput.mockRejectedValue(error);

      await expect(
        handler.route(
          'interface-id',
          {
            type: UserInputEventType.ButtonClickEvent,
            name: SendFormEvent.ClearRecipient,
          },
          mockContext,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('update transaction review', () => {
    it('executes on supported event', async () => {
      await handler.route(
        'interface-id',
        {
          type: UserInputEventType.ButtonClickEvent,
          name: ReviewTransactionEvent.Send,
        },
        mockContext,
      );

      expect(mockSendFlowUseCases.onReviewInput).toHaveBeenCalledWith(
        'interface-id',
        ReviewTransactionEvent.Send,
        mockContext,
      );
    });

    it('propagates errors from onReviewInput', async () => {
      const error = new Error();
      mockSendFlowUseCases.onReviewInput.mockRejectedValue(error);

      await expect(
        handler.route(
          'interface-id',
          {
            type: UserInputEventType.ButtonClickEvent,
            name: ReviewTransactionEvent.Send,
          },
          mockContext,
        ),
      ).rejects.toThrow(error);
    });
  });
});
