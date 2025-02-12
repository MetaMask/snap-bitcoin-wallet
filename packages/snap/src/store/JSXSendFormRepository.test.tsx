import { mock } from 'jest-mock-extended';

import type { SnapClient, BitcoinAccount, SendFormContext } from '../entities';
import { SENDFORM_NAME, CurrencyUnit } from '../entities';
import { SendFormView } from '../infra/jsx';
import { JSXSendFlowRepository } from './JSXSendFormRepository';

jest.mock('../infra/jsx', () => ({
  SendFormView: jest.fn(),
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

  describe('insert', () => {
    const feeRate = 10;
    const account = mock<BitcoinAccount>({
      id: 'acc-id',
      network: 'bitcoin',
      // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
      /* eslint-disable @typescript-eslint/naming-convention */
      balance: { trusted_spendable: { to_sat: () => BigInt(1234) } },
    });

    it('creates interface with correct context', async () => {
      const btcRate = {
        currency: 'USD',
        conversionRate: 100000,
        conversionDate: 2025,
      };
      mockSnapClient.getCurrencyRate.mockResolvedValue(btcRate);
      mockSnapClient.createInterface.mockResolvedValue('interface-id');
      (SendFormView as jest.Mock).mockReturnValue({});

      const result = await repo.insertForm(account, feeRate);

      const expectedContext: SendFormContext = {
        balance: '1234',
        currency: CurrencyUnit.Bitcoin,
        account: 'acc-id',
        network: 'bitcoin',
        feeRate,
        errors: {},
        fiatRate: btcRate,
      };
      expect(mockSnapClient.getCurrencyRate).toHaveBeenCalledWith(
        CurrencyUnit.Bitcoin,
      );
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        expect.any(Object), // Tested in integration tests
        expectedContext,
      );
      expect(result).toBe('interface-id');
    });
  });

  describe('update', () => {
    it('updates interface with context', async () => {
      (SendFormView as jest.Mock).mockReturnValue({});
      const id = 'interface-id';
      const context = mock<SendFormContext>();

      await repo.update(id, context);

      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        expect.any(Object), // Tested in integration tests
        context,
      );
    });
  });
});
