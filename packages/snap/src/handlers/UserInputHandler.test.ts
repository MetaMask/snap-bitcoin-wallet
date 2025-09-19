import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { SendFormContext } from '../entities';
import {
  ConfirmationEvent,
  ReviewTransactionEvent,
  SendFormEvent,
} from '../entities';
import type { ConfirmationUseCases, SendFlowUseCases } from '../use-cases';
import { UserInputHandler } from './UserInputHandler';

describe('UserInputHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockConfirmationUseCases = mock<ConfirmationUseCases>();
  const mockContext = mock<SendFormContext>();

  let handler: UserInputHandler;

  beforeEach(() => {
    handler = new UserInputHandler(
      mockSendFlowUseCases,
      mockConfirmationUseCases,
    );
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
          type: UserInputEventType.InputChangeEvent,
          name: SendFormEvent.Recipient,
          value: 'recipient-address',
        },
        mockContext,
      );

      expect(mockSendFlowUseCases.onChangeForm).toHaveBeenCalledWith(
        'interface-id',
        SendFormEvent.Recipient,
        mockContext,
        'recipient-address',
      );
    });

    it('propagates errors from onChangeForm', async () => {
      const error = new Error();
      mockSendFlowUseCases.onChangeForm.mockRejectedValue(error);

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

      expect(mockSendFlowUseCases.onChangeReview).toHaveBeenCalledWith(
        'interface-id',
        ReviewTransactionEvent.Send,
        mockContext,
      );
    });

    it('propagates errors from onChangeReview', async () => {
      const error = new Error();
      mockSendFlowUseCases.onChangeReview.mockRejectedValue(error);

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

  describe('handle confirmation', () => {
    it('executes on confirm', async () => {
      await handler.route(
        'interface-id',
        {
          type: UserInputEventType.ButtonClickEvent,
          name: ConfirmationEvent.Confirm,
        },
        {},
      );

      expect(mockConfirmationUseCases.onChange).toHaveBeenCalledWith(
        'interface-id',
        ConfirmationEvent.Confirm,
      );
    });

    it('executes on cancel', async () => {
      await handler.route(
        'interface-id',
        {
          type: UserInputEventType.ButtonClickEvent,
          name: ConfirmationEvent.Cancel,
        },
        {},
      );

      expect(mockConfirmationUseCases.onChange).toHaveBeenCalledWith(
        'interface-id',
        ConfirmationEvent.Cancel,
      );
    });

    it('propagates errors from onChange', async () => {
      const error = new Error();
      mockConfirmationUseCases.onChange.mockRejectedValue(error);

      await expect(
        handler.route(
          'interface-id',
          {
            type: UserInputEventType.ButtonClickEvent,
            name: ConfirmationEvent.Cancel,
          },
          {},
        ),
      ).rejects.toThrow(error);
    });
  });
});
