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
    it('returns state when found', async () => {
      const state = { foo: 'bar' };
      mockSnapClient.getInterfaceState.mockResolvedValue(state);

      const result = await repo.getState('test-id');

      expect(mockSnapClient.getInterfaceState).toHaveBeenCalledWith(
        'test-id',
        SENDFORM_NAME,
      );
      expect(result).toEqual(state);
    });

    it('throws error if state is missing', async () => {
      mockSnapClient.getInterfaceState.mockResolvedValue(null);

      await expect(repo.getState('test-id')).rejects.toThrow(
        'Missing state from Send Form',
      );
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
    const fiatRate = {
      currency: 'USD',
      conversionRate: 100000,
      conversionDate: 2025,
    };

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
        fiatRate,
      };

      const result = await repo.insertForm(mockAccount, feeRate, fiatRate);

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
