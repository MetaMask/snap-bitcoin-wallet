import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { CurrencyUnit } from '../src/entities';
import { Caip2AddressType, Caip19Asset } from '../src/handlers/caip';
import { FUNDING_TX, MNEMONIC, ORIGIN, TEST_ADDRESS } from './constants';

describe('Keyring', () => {
  const accounts: Record<string, KeyringAccount> = {};
  let snap: Snap;

  beforeAll(async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });
  });

  it.each([
    {
      // Main account used in the tests, only one to synchronize
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScope.Regtest,
      index: 0,
      expectedAddress: TEST_ADDRESS,
      synchronize: true,
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: 'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
      synchronize: false,
    },
    {
      // Tests multiple accounts of same address type
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScope.Mainnet,
      index: 1,
      expectedAddress: 'bc1qe2e3tdkqwytw7furyl2nlfy3sqs23acynn50d9',
      synchronize: false,
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: '15feVv7kK3z7jxA4RZZzY7Fwdu3yqFwzcT',
      synchronize: false,
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
      synchronize: false,
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: '3QVSaDYjxEh4L3K24eorrQjfVxPAKJMys2',
      synchronize: false,
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress: '2NBG623WvXp1zxKB6gK2mnMe2mSDCur5qRU',
      synchronize: false,
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress:
        'bc1p4rue37y0v9snd4z3fvw43d29u97qxf9j3fva72xy2t7hekg24dzsaz40mz',
      synchronize: false,
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: BtcScope.Testnet,
      index: 0,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
      synchronize: false,
    },
  ])('creates an account: %s', async ({ expectedAddress, ...requestOpts }) => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });

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

    if ('result' in response.response) {
      accounts[
        `${requestOpts.addressType}:${requestOpts.scope}:${requestOpts.index}`
      ] = response.response.result as KeyringAccount;
    }
  });

  it('returns the same account if already exists', async () => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });

    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Mainnet,
          addressType: Caip2AddressType.P2wpkh,
        },
      },
    });

    expect(response).toRespondWith(
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScope.Mainnet}:0`],
    );
  });

  it('gets an account', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_getAccount',
      params: {
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScope.Mainnet}:0`].id,
      },
    });

    expect(response).toRespondWith(
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScope.Mainnet}:0`],
    );
  });

  it('lists all accounts', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_listAccounts',
    });

    expect(response).toRespondWith(Object.values(accounts));
  });

  it('lists account transactions', async () => {
    const accoundId =
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScope.Regtest}:0`].id;
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
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScope.Regtest}:0`].id,
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
    const { id } = accounts[`${Caip2AddressType.P2pkh}:${BtcScope.Mainnet}:0`];

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
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScope.Mainnet,
      expectedAssets: [Caip19Asset.Bitcoin],
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScope.Regtest,
      expectedAssets: [Caip19Asset.Regtest],
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: BtcScope.Testnet,
      expectedAssets: [Caip19Asset.Testnet],
    },
  ])(
    'lists account assets: %s',
    async ({ addressType, scope, expectedAssets }) => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: 'keyring_listAccountAssets',
        params: {
          id: accounts[`${addressType}:${scope}:0`].id,
        },
      });

      expect(response).toRespondWith(expectedAssets);
    },
  );
});
