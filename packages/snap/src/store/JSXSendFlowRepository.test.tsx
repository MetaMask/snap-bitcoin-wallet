import type { AddressInfo } from 'bitcoindevkit';
import { mock } from 'jest-mock-extended';

import type {
  SnapClient,
  SendFormContext,
  ReviewTransactionContext,
  BitcoinAccount,
} from '../entities';
import { CurrencyUnit, SENDFORM_NAME } from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';
import { JSXSendFlowRepository } from './JSXSendFlowRepository';

jest.mock('../infra/jsx', () => ({
  SendFormView: jest.fn(),
  ReviewTransactionView: jest.fn(),
}));

describe('JSXSendFlowRepository', () => {
  const mockSnapClient = mock<SnapClient>();
  let repo: JSXSendFlowRepository;

  beforeEach(() => {
    repo = new JSXSendFlowRepository(mockSnapClient);
  });

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

    it('returns null if send form state not present in interface state', async () => {
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

    it('returns null if interface is not found', async () => {
      const id = 'test-id';
      mockSnapClient.getInterfaceContext.mockRejectedValue(
        new Error(`Interface with id '${id}' not found.`),
      );

      const result = await repo.getContext(id);

      expect(result).toBeNull();
    });

    it('propagates error from getInterfaceContext', async () => {
      const error = new Error('getInterfaceContext failed');
      mockSnapClient.getInterfaceContext.mockRejectedValue(error);

      await expect(repo.getContext('test-id')).rejects.toBe(error);
    });
  });

  describe('insertForm', () => {
    const feeRate = 10;
    const mockAccount = mock<BitcoinAccount>({
      id: 'acc-id',
      network: 'bitcoin',
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      balance: { trusted_spendable: { to_sat: () => BigInt(1234) } },
      peekAddress: jest.fn(),
    });

    it('creates interface with correct context', async () => {
      mockSnapClient.createInterface.mockResolvedValue('interface-id');
      mockAccount.peekAddress.mockReturnValue({
        address: 'myAddress',
      } as AddressInfo);
      const expectedContext: SendFormContext = {
        balance: '1234',
        currency: CurrencyUnit.Bitcoin,
        account: { id: 'acc-id', address: 'myAddress' },
        network: 'bitcoin',
        feeRate,
        errors: {},
      };

      const result = await repo.insertForm(mockAccount, feeRate);

      expect(mockAccount.peekAddress).toHaveBeenCalledWith(0);
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        <SendFormView {...expectedContext} />,
        expectedContext,
      );
      expect(result).toBe('interface-id');
    });
  });

  describe('updateForm', () => {
    it('updates interface with context', async () => {
      const id = 'interface-id';
      const mockContext = mock<SendFormContext>({});

      await repo.updateForm(id, mockContext);

      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        <SendFormView {...mockContext} />,
        mockContext,
      );
    });
  });

  describe('updateReview', () => {
    it('updates interface with context', async () => {
      const id = 'interface-id';
      const mockContext = mock<ReviewTransactionContext>({});

      await repo.updateReview(id, mockContext);

      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        <ReviewTransactionView {...mockContext} />,
        mockContext,
      );
    });
  });
});
