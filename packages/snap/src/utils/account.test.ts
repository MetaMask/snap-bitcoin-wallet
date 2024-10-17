import { BtcMethod, type KeyringAccount } from '@metamask/keyring-api';
import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidV4 } from 'uuid';

import type { BtcAccount } from '../bitcoin/wallet';
import { BtcAccountDeriver, BtcWallet } from '../bitcoin/wallet';
import { Config } from '../config';
import { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { verifyIfAccountValid } from './account';

jest.mock('./snap');

describe('verifyIfAccountValid', function () {
  const createMockDeriver = (network) => {
    return {
      instance: new BtcAccountDeriver(network),
    };
  };

  const createBtcAccount = async (network: Network, index = 0) => {
    const { instance } = createMockDeriver(network);
    const wallet = new BtcWallet(instance, network);
    return await wallet.unlock(index, Config.wallet.defaultAccountType);
  };

  const createKeyringAccount = (
    address: string,
    caip2ChainId: string,
    index: number,
  ) => {
    return {
      type: Config.wallet.defaultAccountType,
      id: uuidV4(),
      address,
      options: {
        scope: caip2ChainId,
        index,
      },
      methods: [BtcMethod.SendBitcoin],
    } as unknown as KeyringAccount;
  };

  it('does not throw error if `BtcAccount` object and the `KeyringAccount` object are valid and consistent', async function () {
    const btcAccount = await createBtcAccount(networks.testnet);
    const keyringAccount = createKeyringAccount(
      btcAccount.address,
      Caip2ChainId.Testnet,
      btcAccount.index,
    );

    expect(() =>
      verifyIfAccountValid(btcAccount, keyringAccount),
    ).not.toThrow();
  });

  it('throws AccountNotFoundError if either the `BtcAccount` object or the `KeyringAccount` object is not provided', async function () {
    const btcAccount = await createBtcAccount(networks.testnet);
    const keyringAccount = createKeyringAccount(
      btcAccount.address,
      Caip2ChainId.Testnet,
      btcAccount.index,
    );

    expect(() =>
      verifyIfAccountValid(btcAccount, null as unknown as KeyringAccount),
    ).toThrow(AccountNotFoundError);
    expect(() =>
      verifyIfAccountValid(null as unknown as BtcAccount, keyringAccount),
    ).toThrow(AccountNotFoundError);
  });

  it("throws `Inconsistent account found` error if the BtcAccount's address is not matching the KeyringAccount's address", async function () {
    const btcAccount = await createBtcAccount(networks.testnet, 0);
    const inconsistentBtcAccount = await createBtcAccount(networks.testnet, 1);
    const keyringAccount = createKeyringAccount(
      inconsistentBtcAccount.address,
      Caip2ChainId.Testnet,
      inconsistentBtcAccount.index,
    );

    expect(() => verifyIfAccountValid(btcAccount, keyringAccount)).toThrow(
      new AccountNotFoundError('Inconsistent account found'),
    );
  });
});
