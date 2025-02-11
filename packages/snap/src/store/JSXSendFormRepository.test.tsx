import { JSXSendFormRepository } from './JSXSendFormRepository';
import {
  SENDFORM_NAME,
  CurrencyUnit,
  SnapClient,
  BitcoinAccount,
  SendFormContext,
} from '../entities';
import { mock } from 'jest-mock-extended';
import { SendFormView } from '../infra/jsx';

describe('JSXSendFormRepository', () => {
  const mockSnapClient = mock<SnapClient>();
  let repo: JSXSendFormRepository;

  beforeEach(() => {
    repo = new JSXSendFormRepository(mockSnapClient);
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
      balance: { trusted_spendable: { to_sat: () => BigInt(1234) } },
    });

    it('creates interface with correct context', async () => {
      const btcRate = 100000;
      mockSnapClient.getCurrencyRate.mockResolvedValue(btcRate);
      mockSnapClient.createInterface.mockResolvedValue('interface-id');

      const result = await repo.insert(account, feeRate);

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
        <SendFormView {...expectedContext} />,
        expectedContext,
      );
      expect(result).toBe('interface-id');
    });
  });

  describe('update', () => {
    it('updates interface with context', async () => {
      const id = 'interface-id';
      const context = mock<SendFormContext>();

      await repo.update(id, context);

      expect(mockSnapClient.updateInterface).toHaveBeenCalledWith(
        id,
        <SendFormView {...context} />,
        context,
      );
    });
  });
});
