import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type {
  SnapClient,
  SendFormContext,
  ReviewTransactionContext,
  Translator,
} from '../entities';
import { SENDFORM_NAME } from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';
import { JSXSendFlowRepository } from './JSXSendFlowRepository';

jest.mock('../infra/jsx', () => ({
  SendFormView: jest.fn(),
  ReviewTransactionView: jest.fn(),
}));

describe('JSXSendFlowRepository', () => {
  const mockMessages = { foo: { message: 'bar' } };

  const mockSnapClient = mock<SnapClient>();
  const mockTranslator = mock<Translator>({ messages: mockMessages });

  const repo = new JSXSendFlowRepository(mockSnapClient, mockTranslator);

  describe('getState', () => {
    it('returns send form state if found', async () => {
      const id = 'test-id';
      const state = { [SENDFORM_NAME]: 'bar' };
      mockSnapClient.getInterfaceState.mockResolvedValue(state);

      const result = await repo.getState(id);

      expect(mockSnapClient.getInterfaceState).toHaveBeenCalledWith(id);
      expect(result).toEqual(state[SENDFORM_NAME]);
    });

    it('returns null if state is null', async () => {
      mockSnapClient.getInterfaceState.mockResolvedValue(null);

      const result = await repo.getState('test-id');

      expect(result).toBeNull();
    });

    it('returns null if send form state is not present in interface state', async () => {
      const state = { unknownField: 'bar' };
      mockSnapClient.getInterfaceState.mockResolvedValue(state);

      const result = await repo.getState('test-id');

      expect(result).toBeNull();
    });
  });

  describe('getContext', () => {
    it('returns context if found', async () => {
      const context = { foo: 'bar' };
      const id = 'test-id';
      mockSnapClient.getInterfaceContext.mockResolvedValue(context);

      const result = await repo.getContext(id);

      expect(mockSnapClient.getInterfaceContext).toHaveBeenCalledWith(id);
      expect(result).toEqual(context);
    });

    it('returns null if context is null', async () => {
      mockSnapClient.getInterfaceContext.mockResolvedValue(null);

      const result = await repo.getContext('test-id');

      expect(result).toBeNull();
    });

    it('propagates error from getInterfaceContext', async () => {
      const error = new Error('getInterfaceContext failed');
      mockSnapClient.getInterfaceContext.mockRejectedValue(error);

      await expect(repo.getContext('test-id')).rejects.toBe(error);
    });
  });

  describe('insertForm', () => {
    it('creates interface with correct context', async () => {
      const mockContext = mock<SendFormContext>({ locale: 'en' });
      mockSnapClient.createInterface.mockResolvedValue('interface-id');

      const result = await repo.insertForm(mockContext);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        <SendFormView context={mockContext} messages={mockMessages} />,
        mockContext,
      );
      expect(mockTranslator.load).toHaveBeenCalledWith('en');
      expect(result).toBe('interface-id');
    });
  });

  describe('updateForm', () => {
    it('updates interface with context', async () => {
      const id = 'interface-id';
      const mockContext = mock<SendFormContext>({ locale: 'de' });
      mockSnapClient.getPreferences.mockResolvedValue({
        locale: 'en',
      } as GetPreferencesResult);

      await repo.updateForm(id, mockContext);

      expect(mockTranslator.load).toHaveBeenCalledWith('de');
      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        <SendFormView context={mockContext} messages={mockMessages} />,
        mockContext,
      );
    });
  });

  describe('updateReview', () => {
    it('updates interface with context', async () => {
      const id = 'interface-id';
      const mockContext = mock<ReviewTransactionContext>({ locale: 'fr' });
      mockSnapClient.getPreferences.mockResolvedValue({
        locale: 'en',
      } as GetPreferencesResult);

      await repo.updateReview(id, mockContext);

      expect(mockTranslator.load).toHaveBeenCalledWith('fr');
      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        <ReviewTransactionView context={mockContext} messages={{}} />,
        mockContext,
      );
    });
  });
});
