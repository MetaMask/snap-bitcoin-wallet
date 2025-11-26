import type { Address } from '@metamask/bitcoindevkit';
import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type {
  SnapClient,
  Translator,
  BitcoinAccount,
  BlockchainClient,
} from '../entities';
import { JSXConfirmationRepository } from './JSXConfirmationRepository';
import { SignMessageConfirmationView } from '../infra/jsx';

jest.mock('../infra/jsx', () => ({
  SignMessageConfirmationView: jest.fn(),
}));

describe('JSXConfirmationRepository', () => {
  const mockMessages = { foo: { message: 'bar' } };
  const mockSnapClient = mock<SnapClient>();
  const mockTranslator = mock<Translator>();
  const mockChainClient = mock<BlockchainClient>();

  const repo = new JSXConfirmationRepository(
    mockSnapClient,
    mockTranslator,
    mockChainClient,
  );

  describe('insertSignMessage', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'account-id',
      publicAddress: mock<Address>({ toString: () => 'myAddress' }),
    });
    const message = 'message';
    const origin = 'origin';
    const expectedContext = {
      message,
      origin,
      account: {
        id: mockAccount.id,
        address: mockAccount.publicAddress.toString(),
      },
      network: mockAccount.network,
    };

    beforeEach(() => {
      mockSnapClient.createInterface.mockResolvedValue('interface-id');
      mockSnapClient.displayConfirmation.mockResolvedValue(true);
      mockTranslator.load.mockResolvedValue(mockMessages);
      mockSnapClient.getPreferences.mockResolvedValue({
        locale: 'en',
      } as GetPreferencesResult);
    });

    it('creates and displays a sign message interface', async () => {
      await repo.insertSignMessage(mockAccount, message, origin);

      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        <SignMessageConfirmationView
          context={expectedContext}
          messages={mockMessages}
        />,
        expectedContext,
      );
      expect(mockTranslator.load).toHaveBeenCalledWith('en');
      expect(mockSnapClient.displayConfirmation).toHaveBeenCalledWith(
        'interface-id',
      );
    });

    it('throws UserActionError if the interface returns false', async () => {
      mockSnapClient.displayConfirmation.mockResolvedValue(false);
      await expect(
        repo.insertSignMessage(mockAccount, message, origin),
      ).rejects.toThrow('User canceled the confirmation');
    });
  });
});
