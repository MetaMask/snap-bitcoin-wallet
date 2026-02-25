import type {
  Address,
  Amount,
  Psbt,
  ScriptBuf,
  Transaction,
  TxOut,
} from '@metamask/bitcoindevkit';
import { Address as BdkAddress } from '@metamask/bitcoindevkit';
import type { GetPreferencesResult } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type {
  AssetRatesClient,
  SnapClient,
  Translator,
  BitcoinAccount,
  BlockchainClient,
  SpotPrice,
} from '../entities';
import { networkToCurrencyUnit } from '../entities';
import { JSXConfirmationRepository } from './JSXConfirmationRepository';
import { SignMessageConfirmationView } from '../infra/jsx';
import { UnifiedSendFormView } from '../infra/jsx/unified-send-flow';

/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Address: {
    from_script: jest.fn(),
  },
}));

const MockedBdkAddress = jest.mocked(BdkAddress);

jest.mock('../infra/jsx', () => ({
  SignMessageConfirmationView: jest.fn(),
  SignPsbtConfirmationView: jest.fn(),
}));

jest.mock('../infra/jsx/unified-send-flow', () => ({
  UnifiedSendFormView: jest.fn(),
}));

describe('JSXConfirmationRepository', () => {
  const mockMessages = { foo: { message: 'bar' } };
  const mockSnapClient = mock<SnapClient>();
  const mockTranslator = mock<Translator>();
  const mockChainClient = mock<BlockchainClient>();
  const mockRatesClient = mock<AssetRatesClient>();

  const repo = new JSXConfirmationRepository(
    mockSnapClient,
    mockTranslator,
    mockChainClient,
    mockRatesClient,
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
      mockSnapClient.getPreferences.mockResolvedValue(
        mock<GetPreferencesResult>({ locale: 'en' }),
      );
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

  describe('insertSendTransfer', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: 'account-id',
      network: 'bitcoin',
      publicAddress: mock<Address>({ toString: () => 'fromAddress' }),
    });
    const mockPsbt = mock<Psbt>({
      toString: () => 'serialized-psbt',
    });
    const recipient = { address: 'toAddress', amount: '50000' };
    const origin = 'dapp-origin';

    beforeEach(() => {
      mockSnapClient.createInterface.mockResolvedValue('send-interface-id');
      mockSnapClient.displayConfirmation.mockResolvedValue(true);
      mockTranslator.load.mockResolvedValue(mockMessages);
      mockSnapClient.getPreferences.mockResolvedValue(
        mock<GetPreferencesResult>({ locale: 'en', currency: 'usd' }),
      );
      mockChainClient.getExplorerUrl.mockReturnValue('https://mempool.space');
      mockRatesClient.spotPrices.mockResolvedValue(
        mock<SpotPrice>({ price: 50000 }),
      );
    });

    it('creates and displays a send transfer interface', async () => {
      await repo.insertSendTransfer(mockAccount, mockPsbt, recipient, origin);

      const expectedContext = {
        from: 'fromAddress',
        explorerUrl: 'https://mempool.space',
        network: mockAccount.network,
        currency: networkToCurrencyUnit[mockAccount.network],
        exchangeRate: expect.objectContaining({
          conversionRate: 50000,
          currency: 'USD',
        }),
        recipient: recipient.address,
        amount: recipient.amount,
        locale: 'en',
        psbt: 'serialized-psbt',
        origin,
      };

      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockChainClient.getExplorerUrl).toHaveBeenCalledWith(
        mockAccount.network,
      );
      expect(mockTranslator.load).toHaveBeenCalledWith('en');
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        <UnifiedSendFormView
          context={expectedContext}
          messages={mockMessages}
        />,
        expectedContext,
      );
      expect(mockSnapClient.displayConfirmation).toHaveBeenCalledWith(
        'send-interface-id',
      );
    });

    it('throws UserActionError if the user cancels', async () => {
      mockSnapClient.displayConfirmation.mockResolvedValue(false);
      await expect(
        repo.insertSendTransfer(mockAccount, mockPsbt, recipient, origin),
      ).rejects.toThrow('User canceled the confirmation');
    });

    it('sets exchangeRate to undefined for non-mainnet networks', async () => {
      const testnetAccount = mock<BitcoinAccount>({
        id: 'account-id',
        network: 'testnet',
        publicAddress: mock<Address>({ toString: () => 'fromAddress' }),
      });

      await repo.insertSendTransfer(
        testnetAccount,
        mockPsbt,
        recipient,
        origin,
      );

      expect(mockRatesClient.spotPrices).not.toHaveBeenCalled();
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ exchangeRate: undefined }),
      );
    });

    it('sets exchangeRate to undefined when spot price is null', async () => {
      // @ts-expect-error - testing runtime guard against API returning null
      mockRatesClient.spotPrices.mockResolvedValue({ price: null });

      await repo.insertSendTransfer(mockAccount, mockPsbt, recipient, origin);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ exchangeRate: undefined }),
      );
    });

    it('sets exchangeRate to undefined when rates client throws', async () => {
      mockRatesClient.spotPrices.mockRejectedValue(new Error('API error'));

      await repo.insertSendTransfer(mockAccount, mockPsbt, recipient, origin);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ exchangeRate: undefined }),
      );
    });
  });

  describe('insertSignPsbt', () => {
    const mockScriptRecipient = mock<ScriptBuf>({
      is_op_return: () => false,
    });
    const mockTxOut = mock<TxOut>({
      value: mock<Amount>({
        to_sat: () => BigInt(1000),
      }),
      script_pubkey: mockScriptRecipient,
    });

    const mockAccount = mock<BitcoinAccount>({
      id: 'account-id',
      network: 'bitcoin',
      publicAddress: mock<Address>({ toString: () => 'myAddress' }),
      isMine: () => false,
    });

    const mockSignPsbt = mock<Psbt>({
      toString: () => 'psbt-base64-string',
      fee_amount: () =>
        mock<Amount>({
          to_sat: () => BigInt(500),
        }),
      unsigned_tx: mock<Transaction>({
        output: [mockTxOut],
        input: [{}],
      }),
    });

    const options = { fill: true, broadcast: false };
    const origin = 'https://dapp.example.com';

    beforeEach(() => {
      mockSnapClient.createInterface.mockResolvedValue('psbt-interface-id');
      mockSnapClient.displayConfirmation.mockResolvedValue(true);
      mockTranslator.load.mockResolvedValue(mockMessages);
      mockSnapClient.getPreferences.mockResolvedValue(
        mock<GetPreferencesResult>({ locale: 'en', currency: 'usd' }),
      );
      mockRatesClient.spotPrices.mockResolvedValue(
        mock<SpotPrice>({ price: 50000 }),
      );
      MockedBdkAddress.from_script.mockReturnValue(
        mock<Address>({ toString: () => 'resolved-address' }),
      );
    });

    it('creates and displays a sign PSBT confirmation interface with parsed outputs', async () => {
      await repo.insertSignPsbt(mockAccount, mockSignPsbt, origin, options);

      expect(mockSnapClient.getPreferences).toHaveBeenCalled();
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          fee: '500',
          currency: networkToCurrencyUnit[mockAccount.network],
          exchangeRate: expect.objectContaining({
            conversionRate: 50000,
            currency: 'USD',
          }),
          outputs: [
            {
              address: 'resolved-address',
              amount: '1000',
              isMine: false,
              isOpReturn: false,
            },
          ],
          inputCount: 1,
        }),
      );
      expect(mockSnapClient.displayConfirmation).toHaveBeenCalledWith(
        'psbt-interface-id',
      );
    });

    it('marks change outputs with isMine true', async () => {
      const changeAccount = mock<BitcoinAccount>({
        id: 'account-id',
        network: 'bitcoin',
        publicAddress: mock<Address>({ toString: () => 'myAddress' }),
        isMine: () => true,
      });

      await repo.insertSignPsbt(changeAccount, mockSignPsbt, origin, options);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          outputs: [expect.objectContaining({ isMine: true })],
        }),
      );
    });

    it('handles OP_RETURN outputs', async () => {
      const opReturnScript = mock<ScriptBuf>({
        is_op_return: () => true,
      });
      const opReturnOut = mock<TxOut>({
        value: mock<Amount>({
          to_sat: () => BigInt(0),
        }),
        script_pubkey: opReturnScript,
      });
      const psbtWithOpReturn = mock<Psbt>({
        toString: () => 'psbt-op-return',
        fee_amount: () =>
          mock<Amount>({
            to_sat: () => BigInt(300),
          }),
        unsigned_tx: mock<Transaction>({
          output: [opReturnOut],
          input: [],
        }),
      });

      await repo.insertSignPsbt(mockAccount, psbtWithOpReturn, origin, options);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          outputs: [
            {
              address: undefined,
              amount: '0',
              isMine: false,
              isOpReturn: true,
            },
          ],
          inputCount: 0,
        }),
      );
    });

    it('throws UserActionError if the user cancels', async () => {
      mockSnapClient.displayConfirmation.mockResolvedValue(false);
      await expect(
        repo.insertSignPsbt(mockAccount, mockSignPsbt, origin, options),
      ).rejects.toThrow('User canceled the confirmation');
    });

    it('handles PSBT without fee information gracefully', async () => {
      const psbtNoFee = mock<Psbt>({
        toString: () => 'psbt-no-fee',
        fee_amount: () => undefined as unknown as Amount,
        unsigned_tx: mock<Transaction>({
          output: [],
          input: [],
        }),
      });
      await repo.insertSignPsbt(mockAccount, psbtNoFee, origin, options);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ fee: undefined }),
      );
    });

    it('handles PSBT fee_amount throwing an error gracefully', async () => {
      const psbtFeeError = mock<Psbt>({
        toString: () => 'psbt-fee-error',
        fee_amount: () => {
          throw new Error('Missing TxOut data');
        },
        unsigned_tx: mock<Transaction>({
          output: [],
          input: [],
        }),
      });
      await repo.insertSignPsbt(mockAccount, psbtFeeError, origin, options);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ fee: undefined }),
      );
    });

    it('sets exchangeRate to undefined for non-mainnet networks', async () => {
      const testnetAccount = mock<BitcoinAccount>({
        id: 'account-id',
        network: 'testnet',
        publicAddress: mock<Address>({ toString: () => 'myAddress' }),
        isMine: () => false,
      });

      await repo.insertSignPsbt(testnetAccount, mockSignPsbt, origin, options);

      expect(mockRatesClient.spotPrices).not.toHaveBeenCalled();
      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ exchangeRate: undefined }),
      );
    });

    it('sets address to undefined when BdkAddress.from_script throws', async () => {
      MockedBdkAddress.from_script.mockImplementation(() => {
        throw new Error('Unrecognized script');
      });

      await repo.insertSignPsbt(mockAccount, mockSignPsbt, origin, options);

      expect(mockSnapClient.createInterface).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          outputs: [
            {
              address: undefined,
              amount: '1000',
              isMine: false,
              isOpReturn: false,
            },
          ],
        }),
      );
    });
  });
});
