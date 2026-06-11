// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
import type {
  ChangeSet,
  DescriptorPair,
  Network,
} from '@metamask/bitcoindevkit';
import { Wallet } from '@metamask/bitcoindevkit';
import { mock } from 'jest-mock-extended';

import { WalletError } from '../entities';
import { BdkAccountAdapter } from './BdkAccountAdapter';

jest.mock('@metamask/bitcoindevkit', () => ({
  FeeRate: jest.fn(),
  OutPoint: { from_string: jest.fn() },
  SignOptions: jest.fn(),
  Txid: { from_string: jest.fn() },
  UnconfirmedTx: jest.fn(),
  Wallet: {
    create: jest.fn(),
    load: jest.fn(),
  },
}));

describe('BdkAccountAdapter', () => {
  const mockWallet = mock<Wallet>();
  const mockId = 'test-id';
  const mockDerivationPath = ['m', "84'", "0'", "0'"];
  const mockDescriptors = mock<DescriptorPair>({
    external: 'ext-desc',
    internal: 'int-desc',
  });
  const mockChangeSet = mock<ChangeSet>();
  const mockNetwork: Network = 'bitcoin';

  beforeEach(() => {
    jest.mocked(Wallet.create).mockReturnValue(mockWallet);
    jest.mocked(Wallet.load).mockReturnValue(mockWallet);
  });

  describe('WebAssembly availability guard', () => {
    // eslint-disable-next-line no-restricted-globals -- needed to save/restore the WebAssembly global in tests
    let originalWebAssembly: typeof WebAssembly;

    beforeEach(() => {
      originalWebAssembly = globalThis.WebAssembly;
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'WebAssembly', {
        configurable: true,
        value: originalWebAssembly,
        writable: true,
      });
    });

    /** Simulates an environment where WebAssembly is unavailable (e.g., iOS Lockdown Mode). */
    function disableWebAssembly(): void {
      Object.defineProperty(globalThis, 'WebAssembly', {
        configurable: true,
        value: undefined,
        writable: true,
      });
    }

    describe('create', () => {
      it('throws WalletError when WebAssembly is unavailable', () => {
        disableWebAssembly();

        expect(() =>
          BdkAccountAdapter.create(
            mockId,
            mockDerivationPath,
            mockDescriptors,
            mockNetwork,
          ),
        ).toThrow(WalletError);
      });

      it('error message mentions iOS Lockdown Mode', () => {
        disableWebAssembly();

        expect(() =>
          BdkAccountAdapter.create(
            mockId,
            mockDerivationPath,
            mockDescriptors,
            mockNetwork,
          ),
        ).toThrow(/Lockdown Mode/u);
      });

      it('does not call Wallet.create when WebAssembly is unavailable', () => {
        disableWebAssembly();

        expect(() =>
          BdkAccountAdapter.create(
            mockId,
            mockDerivationPath,
            mockDescriptors,
            mockNetwork,
          ),
        ).toThrow(WalletError);
        expect(Wallet.create).not.toHaveBeenCalled();
      });

      it('calls Wallet.create when WebAssembly is available', () => {
        BdkAccountAdapter.create(
          mockId,
          mockDerivationPath,
          mockDescriptors,
          mockNetwork,
        );

        expect(Wallet.create).toHaveBeenCalledWith(
          mockNetwork,
          mockDescriptors.external,
          mockDescriptors.internal,
        );
      });

      it('returns a BdkAccountAdapter instance when WebAssembly is available', () => {
        const result = BdkAccountAdapter.create(
          mockId,
          mockDerivationPath,
          mockDescriptors,
          mockNetwork,
        );

        expect(result).toBeInstanceOf(BdkAccountAdapter);
      });
    });

    describe('load', () => {
      it('throws WalletError when WebAssembly is unavailable', () => {
        disableWebAssembly();

        expect(() =>
          BdkAccountAdapter.load(mockId, mockDerivationPath, mockChangeSet),
        ).toThrow(WalletError);
      });

      it('error message mentions iOS Lockdown Mode', () => {
        disableWebAssembly();

        expect(() =>
          BdkAccountAdapter.load(mockId, mockDerivationPath, mockChangeSet),
        ).toThrow(/Lockdown Mode/u);
      });

      it('does not call Wallet.load when WebAssembly is unavailable', () => {
        disableWebAssembly();

        expect(() =>
          BdkAccountAdapter.load(mockId, mockDerivationPath, mockChangeSet),
        ).toThrow(WalletError);
        expect(Wallet.load).not.toHaveBeenCalled();
      });

      it('calls Wallet.load without descriptors', () => {
        BdkAccountAdapter.load(mockId, mockDerivationPath, mockChangeSet);

        expect(Wallet.load).toHaveBeenCalledWith(mockChangeSet);
      });

      it('calls Wallet.load with descriptors', () => {
        BdkAccountAdapter.load(
          mockId,
          mockDerivationPath,
          mockChangeSet,
          mockDescriptors,
        );

        expect(Wallet.load).toHaveBeenCalledWith(
          mockChangeSet,
          mockDescriptors.external,
          mockDescriptors.internal,
        );
      });

      it('returns a BdkAccountAdapter instance when WebAssembly is available', () => {
        const result = BdkAccountAdapter.load(
          mockId,
          mockDerivationPath,
          mockChangeSet,
        );

        expect(result).toBeInstanceOf(BdkAccountAdapter);
      });
    });
  });
});
