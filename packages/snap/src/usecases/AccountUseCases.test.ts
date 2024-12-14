import { AddressType, Network } from 'bdk_wasm/bdk_wasm_bg';
import { mock } from 'jest-mock-extended';

import type { BitcoinAccount } from '../entities';
import type { AccountRepository } from '../repositories';
import { AccountUseCases } from './AccountUseCases';

jest.mock('../utils/logger');

describe('AccountUseCases', () => {
  let useCases: AccountUseCases;
  const mockRepository = mock<AccountRepository>();
  const accountIndex = 0;

  beforeEach(() => {
    useCases = new AccountUseCases(mockRepository, accountIndex);
  });

  describe('createAccount', () => {
    const network = Network.Bitcoin;
    const addressType = AddressType.P2wpkh;
    const mockAccount = mock<BitcoinAccount>();

    beforeEach(() => {
      mockRepository.insert.mockResolvedValue(mockAccount);
    });

    it.each([
      { tAddressType: AddressType.P2pkh, purpose: "44'" },
      { tAddressType: AddressType.P2sh, purpose: "49'" },
      { tAddressType: AddressType.P2wpkh, purpose: "84'" },
      { tAddressType: AddressType.P2tr, purpose: "86'" },
    ])(
      'should create an account of type: %s',
      async ({ purpose, tAddressType }) => {
        const derivationPath = ['m', purpose, "0'", `${accountIndex}'`];

        await useCases.createAccount(network, tAddressType);

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          derivationPath,
        );
        expect(mockRepository.insert).toHaveBeenCalledWith(
          derivationPath,
          network,
          tAddressType,
        );
      },
    );

    it.each([
      { tNetwork: Network.Bitcoin, coinType: "0'" },
      { tNetwork: Network.Testnet, coinType: "1'" },
      { tNetwork: Network.Testnet4, coinType: "1'" },
      { tNetwork: Network.Signet, coinType: "1'" },
      { tNetwork: Network.Regtest, coinType: "1'" },
    ])(
      'should create an account on network: %s',
      async ({ tNetwork, coinType }) => {
        const expectedDerivationPath = [
          'm',
          "84'",
          coinType,
          `${accountIndex}'`,
        ];

        await useCases.createAccount(tNetwork, addressType);

        expect(mockRepository.getByDerivationPath).toHaveBeenCalledWith(
          expectedDerivationPath,
        );
        expect(mockRepository.insert).toHaveBeenCalledWith(
          expectedDerivationPath,
          tNetwork,
          addressType,
        );
      },
    );

    it('should return an existing account if one already exists', async () => {
      const mockExistingAccount = mock<BitcoinAccount>();
      mockRepository.getByDerivationPath.mockResolvedValue(mockExistingAccount);

      const result = await useCases.createAccount(network, addressType);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).not.toHaveBeenCalled();
      expect(result).toBe(mockExistingAccount);
    });

    it('should create a new account if one does not exist', async () => {
      mockRepository.getByDerivationPath.mockResolvedValue(null);

      const result = await useCases.createAccount(network, addressType);

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();

      expect(result).toBe(mockAccount);
    });

    it('should propagate an error if getByDerivationPath throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockRejectedValue(error);

      await expect(useCases.createAccount(network, addressType)).rejects.toBe(
        error,
      );

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).not.toHaveBeenCalled();
    });

    it('should propagate an error if insert throws', async () => {
      const error = new Error();
      mockRepository.getByDerivationPath.mockResolvedValue(null);
      mockRepository.insert.mockRejectedValue(error);

      await expect(useCases.createAccount(network, addressType)).rejects.toBe(
        error,
      );

      expect(mockRepository.getByDerivationPath).toHaveBeenCalled();
      expect(mockRepository.insert).toHaveBeenCalled();
    });
  });
});
