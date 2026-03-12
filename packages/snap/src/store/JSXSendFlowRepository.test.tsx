import { mock } from 'jest-mock-extended';

import type {
  SnapClient,
  SendFormContext,
  ConfirmSendFormContext,
  ReviewTransactionContext,
  Translator,
} from '../entities';
import { JSXSendFlowRepository } from './JSXSendFlowRepository';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';
import { UnifiedSendFormView } from '../infra/jsx/unified-send-flow';

jest.mock('../infra/jsx', () => ({
  SendFormView: jest.fn(),
  ReviewTransactionView: jest.fn(),
}));

jest.mock('../infra/jsx/unified-send-flow', () => ({
  UnifiedSendFormView: jest.fn(),
}));

describe('JSXSendFlowRepository', () => {
  const mockMessages = { foo: { message: 'bar' } };

  const mockSnapClient = mock<SnapClient>();
  const mockTranslator = mock<Translator>();

  const repo = new JSXSendFlowRepository(mockSnapClient, mockTranslator);

  describe('getContext', () => {
    it('returns context if found', async () => {
      const context = { foo: 'bar' };
      const id = 'test-id';
      mockSnapClient.getInterfaceContext.mockResolvedValue(context);

      const result = await repo.getContext(id);

      expect(mockSnapClient.getInterfaceContext).toHaveBeenCalledWith(id);
      expect(result).toStrictEqual(context);
    });

    it('throws AssertionError if context is null', async () => {
      mockSnapClient.getInterfaceContext.mockResolvedValue(null);
      await expect(repo.getContext('test-id')).rejects.toThrow(
        'Missing context in send flow interface',
      );
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
      mockTranslator.load.mockResolvedValue(mockMessages);

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
      mockTranslator.load.mockResolvedValue(mockMessages);

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
      mockTranslator.load.mockResolvedValue(mockMessages);

      await repo.updateReview(id, mockContext);

      expect(mockTranslator.load).toHaveBeenCalledWith('fr');
      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        <ReviewTransactionView context={mockContext} messages={mockMessages} />,
        mockContext,
      );
    });
  });

  describe('insertConfirmSendForm', () => {
    it('creates interface with confirm send form context', async () => {
      const mockContext = mock<ConfirmSendFormContext>({ locale: 'en' });
      mockSnapClient.createInterface.mockResolvedValue('confirm-interface-id');
      mockTranslator.load.mockResolvedValue(mockMessages);

      const result = await repo.insertConfirmSendForm(mockContext);

      expect(mockTranslator.load).toHaveBeenCalledWith('en');
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        <UnifiedSendFormView context={mockContext} messages={mockMessages} />,
        mockContext,
      );
      expect(result).toBe('confirm-interface-id');
    });
  });
});
