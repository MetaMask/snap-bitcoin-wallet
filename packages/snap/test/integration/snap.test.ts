import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod, BtcScopes } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { Caip2AddressType } from '../../src/handlers';
import { Caip19Asset } from '../../src/handlers/caip19';

describe('Bitcoin Snap', () => {
  let snap: Snap;
  const accounts: Record<string, KeyringAccount> = {};
  const origin = 'metamask';

  it('installs the Snap and creates a default account', async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase:
          'journey embrace permit coil indoor stereo welcome maid movie easy clock spider tent slush bright luxury awake waste legal modify awkward answer acid goose',
      },
    });
    await snap.onInstall();

    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_listAccounts',
    });

    expect(response).toRespondWith([
      {
        type: Caip2AddressType.P2wpkh,
        id: expect.anything(),
        address: 'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
        options: {},
        scopes: [BtcScopes.Mainnet],
        methods: [BtcMethod.SendBitcoin],
      },
    ]);
  });

  it.each([
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScopes.Mainnet,
      expectedAddress: 'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScopes.Regtest, // Use Regtest instead of Testnet for our tests
      expectedAddress: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: BtcScopes.Mainnet,
      expectedAddress: '15feVv7kK3z7jxA4RZZzY7Fwdu3yqFwzcT',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: BtcScopes.Testnet,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: BtcScopes.Mainnet,
      expectedAddress: '3QVSaDYjxEh4L3K24eorrQjfVxPAKJMys2',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: BtcScopes.Testnet,
      expectedAddress: '2NBG623WvXp1zxKB6gK2mnMe2mSDCur5qRU',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: BtcScopes.Mainnet,
      expectedAddress:
        'bc1p4rue37y0v9snd4z3fvw43d29u97qxf9j3fva72xy2t7hekg24dzsaz40mz',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: BtcScopes.Testnet,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
    },
  ])(
    'creates an account: %s',
    async ({ addressType, scope, expectedAddress }) => {
      snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });

      const response = await snap.onKeyringRequest({
        origin,
        method: 'keyring_createAccount',
        params: {
          options: { scope, addressType },
        },
      });

      expect(response).toRespondWith({
        type: addressType,
        id: expect.anything(),
        address: expectedAddress,
        options: {},
        scopes: [scope],
        methods: [BtcMethod.SendBitcoin],
      });

      if ('result' in response.response) {
        accounts[`${addressType}:${scope}`] = response.response
          .result as KeyringAccount;
      }
    },
  );

  it('returns the same account if already exists', async () => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });

    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScopes.Mainnet,
          addressType: Caip2AddressType.P2wpkh,
        },
      },
    });

    expect(response).toRespondWith(
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Mainnet}`],
    );
  });

  it('gets a Bitcoin account', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_getAccount',
      params: {
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Regtest}`].id,
      },
    });

    expect(response).toRespondWith(
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Regtest}`],
    );
  });

  it('lists all Bitcoin accounts', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_listAccounts',
    });

    expect(response).toRespondWith(Object.values(accounts));
  });

  it('gets the balance of an account', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_getAccountBalances',
      params: {
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Regtest}`].id,
        assets: [Caip19Asset.Regtest],
      },
    });

    expect(response).toRespondWith({
      [Caip19Asset.Regtest]: {
        amount: '500',
        unit: 'BTC',
      },
    });
  });
});
