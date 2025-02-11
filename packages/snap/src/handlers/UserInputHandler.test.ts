import { mock } from 'jest-mock-extended';

import { SendFormContext, SendFormEvent } from '../entities';
import type { SendFormUseCases } from '../use-cases';
import { UserInputHandler } from './UserInputHandler';
import { UserInputEvent, UserInputEventType } from '@metamask/snaps-sdk';

describe('UserInputHandler', () => {
  const mockSendFormUseCases = mock<SendFormUseCases>();
  const mockContext = mock<SendFormContext>();

  let handler: UserInputHandler;

  beforeEach(() => {
    handler = new UserInputHandler(mockSendFormUseCases);
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

    it('throws error if unrecognized event type', async () => {
      await expect(
        handler.route(
          'interface-id',
          { type: UserInputEventType.FileUploadEvent } as UserInputEvent,
          {},
        ),
      ).rejects.toThrow('Unsupported event type');
    });
  });

  describe('update send form', () => {
    it('executes on InputChangeEvent', async () => {
      await handler.route(
        'interface-id',
        {
          type: UserInputEventType.InputChangeEvent,
          name: SendFormEvent.Amount,
          value: '1000',
        },
        mockContext,
      );

      expect(mockSendFormUseCases.update).toHaveBeenCalledWith(
        'interface-id',
        SendFormEvent.Amount,
        mockContext,
      );
    });

    it('executes on ButtonClickEvent', async () => {
      await handler.route(
        'interface-id',
        {
          type: UserInputEventType.ButtonClickEvent,
          name: SendFormEvent.ClearRecipient,
        },
        mockContext,
      );

      expect(mockSendFormUseCases.update).toHaveBeenCalledWith(
        'interface-id',
        SendFormEvent.Amount,
        mockContext,
      );
    });

    it('propagates errors from update', async () => {
      const error = new Error();
      mockSendFormUseCases.update.mockRejectedValue(error);

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
});
