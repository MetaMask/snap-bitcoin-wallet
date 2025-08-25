import { mock } from 'jest-mock-extended';

import { ConfirmationEvent, type Logger, type SnapClient } from '../entities';
import { ConfirmationUseCases } from './ConfirmationUseCases';

describe('ConfirmationUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockSnapClient = mock<SnapClient>();

  const useCases = new ConfirmationUseCases(mockLogger, mockSnapClient);

  describe('onChange', () => {
    it('interface resolves to false on cancel', async () => {
      await useCases.onChange('interface-id', ConfirmationEvent.Cancel);
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        false,
      );
    });

    it('interface resolves to true on confirm', async () => {
      await useCases.onChange('interface-id', ConfirmationEvent.Confirm);
      expect(mockSnapClient.resolveInterface).toHaveBeenCalledWith(
        'interface-id',
        true,
      );
    });

    it('throws an error if the event is not recognized', async () => {
      await expect(
        useCases.onChange('interface-id', 'unknown' as ConfirmationEvent),
      ).rejects.toThrow('Unrecognized confirmation event');
    });

    it('propagates an error if resolveInterface fails', async () => {
      const error = new Error('resolveInterface failed');
      mockSnapClient.resolveInterface.mockRejectedValue(error);

      await expect(
        useCases.onChange('interface-id', ConfirmationEvent.Cancel),
      ).rejects.toBe(error);
    });
  });
});
