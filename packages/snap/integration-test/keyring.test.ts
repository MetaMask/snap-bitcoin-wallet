import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcMethod, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import {
  FUNDING_TX,
  MNEMONIC,
  ORIGIN,
  TEST_ADDRESS_REGTEST,
  TEST_ADDRESS_MAINNET,
  TEST_ADDRESS_TESTNET,
} from './constants';
import { CurrencyUnit } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

describe('Keyring', () => {
  const accounts: Record<string, KeyringAccount> = {}; // accounts stored by address
  let snap: Snap;

  beforeAll(async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });
  });

  beforeEach(() => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });
  });

  it('discover accounts successfully', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_discoverAccounts',
      params: {
        scopes: [BtcScope.Regtest], // avoid using other networks than Regtest as real external calls will be performed
        entropySource: 'm', // we don't know the real entropy source so "m" acts as the default
        groupIndex: 0,
      },
    });

    // We should get 1 account, the p2wpkh one of Regtest
    expect(response).toRespondWith([
      {
        type: 'bip44',
        scopes: [BtcScope.Regtest],
        derivationPath: "m/84'/1'/0'",
      },
    ]);
  });

  it('creates discovered account', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          addressType: BtcAccountType.P2wpkh,
          scope: BtcScope.Regtest,
          index: 0,
          synchronize: true,
        },
      },
    });

    expect(response).toRespondWith({
      type: BtcAccountType.P2wpkh,
      id: expect.anything(),
      address: TEST_ADDRESS_REGTEST,
      options: {},
      scopes: [BtcScope.Regtest],
      methods: [BtcMethod.SendBitcoin],
    });

    // eslint-disable-next-line jest/no-conditional-in-test
    if ('result' in response.response) {
      accounts[TEST_ADDRESS_REGTEST] = response.response
        .result as KeyringAccount;
    }
  });

  it.each([
    {
      // tests creation of multiple accounts of same address type and network
      addressType: BtcAccountType.P2wpkh,
      scope: BtcScope.Regtest,
      index: 1, // index incremented by 1
      expectedAddress: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
    },
    {
      addressType: BtcAccountType.P2wpkh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: TEST_ADDRESS_MAINNET,
    },
    {
      addressType: BtcAccountType.P2wpkh,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress: TEST_ADDRESS_TESTNET,
    },
    {
      addressType: BtcAccountType.P2pkh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: '15feVv7kK3z7jxA4RZZzY7Fwdu3yqFwzcT',
    },
    {
      addressType: BtcAccountType.P2pkh,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: BtcAccountType.P2sh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: '3QVSaDYjxEh4L3K24eorrQjfVxPAKJMys2',
    },
    {
      addressType: BtcAccountType.P2sh,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress: '2NBG623WvXp1zxKB6gK2mnMe2mSDCur5qRU',
    },
    {
      addressType: BtcAccountType.P2tr,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress:
        'bc1p4rue37y0v9snd4z3fvw43d29u97qxf9j3fva72xy2t7hekg24dzsaz40mz',
    },
    {
      addressType: BtcAccountType.P2tr,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
    },
  ])('creates an account: %s', async ({ expectedAddress, ...requestOpts }) => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: { options: { ...requestOpts } },
    });

    expect(response).toRespondWith({
      type: requestOpts.addressType,
      id: expect.anything(),
      address: expectedAddress,
      options: {},
      scopes: [requestOpts.scope],
      methods: [BtcMethod.SendBitcoin],
    });

    // eslint-disable-next-line jest/no-conditional-in-test
    if ('result' in response.response) {
      accounts[expectedAddress] = response.response.result as KeyringAccount;
    }
  });

  it('creates account by derivationPath idempotently', async () => {
    // Account already exists so we should get the same account
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Testnet,
          addressType: BtcAccountType.P2wpkh,
          derivationPath: "m/84'/0'/0'",
        },
      },
    });

    expect(response).toRespondWith(accounts[TEST_ADDRESS_TESTNET]);
  });

  it('returns the same account if already exists', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Testnet,
          addressType: BtcAccountType.P2wpkh,
        },
      },
    });

    expect(response).toRespondWith(accounts[TEST_ADDRESS_TESTNET]);
  });

  it('gets an account', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_getAccount',
      params: {
        id: accounts[TEST_ADDRESS_REGTEST]!.id,
      },
    });

    expect(response).toRespondWith(accounts[TEST_ADDRESS_REGTEST]);
  });

  it('lists all accounts', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_listAccounts',
    });

    // eslint-disable-next-line jest/no-conditional-in-test
    if ('result' in response.response) {
      const fetchedAccounts = response.response.result as KeyringAccount[];
      /* console.log(
        'Fetched accounts:',
        JSON.stringify(fetchedAccounts, null, 2),
      );*/

      expect(fetchedAccounts).toHaveLength(Object.keys(accounts).length);
    }

    expect(response).toRespondWith(Object.values(accounts));
  });

  it('lists account transactions', async () => {
    const accoundId = accounts[TEST_ADDRESS_REGTEST]!.id;
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_listAccountTransactions',
      params: {
        id: accoundId,
        pagination: { limit: 10, next: null },
      },
    });

    expect(response).toRespondWith({
      data: [{ ...FUNDING_TX, account: accoundId }],
      next: null,
    });
  });

  it('gets an account balance', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_getAccountBalances',
      params: {
        id: accounts[TEST_ADDRESS_REGTEST]!.id,
        assets: [Caip19Asset.Regtest],
      },
    });

    expect(response).toRespondWith({
      [Caip19Asset.Regtest]: {
        amount: '500',
        unit: CurrencyUnit.Regtest,
      },
    });
  });

  it('removes an account', async () => {
    const { id } =
      accounts[
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h'
      ]!;

    let response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_deleteAccount',
      params: {
        id,
      },
    });

    expect(response).toRespondWith(null);

    response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_getAccount',
      params: {
        id,
      },
    });

    expect(response).toRespondWithError({
      code: -32603,
      message: `Account not found: ${id}`,
      stack: expect.anything(),
    });
  });

  it.each([
    {
      address: TEST_ADDRESS_REGTEST,
      expectedAssets: [Caip19Asset.Regtest],
    },
    {
      address: TEST_ADDRESS_MAINNET,
      expectedAssets: [Caip19Asset.Bitcoin],
    },
    {
      address: TEST_ADDRESS_TESTNET,
      expectedAssets: [Caip19Asset.Testnet],
    },
  ])('lists account assets: %s', async ({ address, expectedAssets }) => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_listAccountAssets',
      params: {
        id: accounts[address]!.id,
      },
    });

    expect(response).toRespondWith(expectedAssets);
  });
});
