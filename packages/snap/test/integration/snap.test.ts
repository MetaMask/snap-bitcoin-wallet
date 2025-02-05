import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod, BtcScopes } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { CurrencyUnit } from '../../src/entities';
import { Caip2AddressType } from '../../src/handlers';
import { Caip19Asset } from '../../src/handlers/caip19';

describe('Bitcoin Snap', () => {
  const accounts: Record<string, KeyringAccount> = {};
  const origin = 'metamask';
  let snap: Snap;

  it('installs the Snap and creates the default account', async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase:
          'journey embrace permit coil indoor stereo welcome maid movie easy clock spider tent slush bright luxury awake waste legal modify awkward answer acid goose',
      },
    });

    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });
    await snap.onInstall();

    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_listAccounts',
    });

    expect(response).toRespondWith([
      {
        type: Caip2AddressType.P2wpkh,
        id: expect.anything(),
        address: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
        options: {},
        scopes: [BtcScopes.Regtest],
        methods: [BtcMethod.SendBitcoin],
      },
    ]);

    if ('result' in response.response) {
      const [defaultAccount] = response.response.result as KeyringAccount[];
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Regtest}`] =
        defaultAccount;
    }
  });

  it('synchronize accounts via cronjob', async () => {
    // IMPORTANT: The order of this test is important because the cron job synchronizes all accounts, doing external requests to backends
    // for mainnet, testnet and signet. Ideally avoid synchronizing accounts outside of regtest as that is tested in e2e.

    await snap.onCronjob({ method: 'synchronize' });

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
        amount: expect.stringMatching(/^[1-9]\d*$/u), // non-zero positive number
        unit: CurrencyUnit.Regtest,
      },
    });
  });

  it.each([
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScopes.Mainnet,
      expectedAddress: 'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
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

  it('gets an account', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_getAccount',
      params: {
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Mainnet}`].id,
      },
    });

    expect(response).toRespondWith(
      accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Mainnet}`],
    );
  });

  it('lists all accounts', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_listAccounts',
    });

    expect(response).toRespondWith(Object.values(accounts));
  });

  it('removes an account', async () => {
    const { id } = accounts[`${Caip2AddressType.P2pkh}:${BtcScopes.Mainnet}`];

    let response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_deleteAccount',
      params: {
        id,
      },
    });

    expect(response).toRespondWith(null);

    response = await snap.onKeyringRequest({
      origin,
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

  it('fails to remove the default account', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_deleteAccount',
      params: {
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Regtest}`].id,
      },
    });

    expect(response).toRespondWithError({
      code: -32603,
      message: 'Default Bitcoin account cannot be removed',
      stack: expect.anything(),
    });
  });

  it('returns empty list for account transactions', async () => {
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_listAccountTransactions',
      params: {
        id: accounts[`${Caip2AddressType.P2wpkh}:${BtcScopes.Regtest}`].id,
        pagination: { limit: 10, next: null },
      },
    });

    expect(response).toRespondWith({
      data: [],
      next: null,
    });
  });

  it.each([
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScopes.Mainnet,
      expectedAssets: [Caip19Asset.Bitcoin],
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: BtcScopes.Regtest,
      expectedAssets: [Caip19Asset.Regtest],
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: BtcScopes.Testnet,
      expectedAssets: [Caip19Asset.Testnet],
    },
  ])(
    'lists account assets: %s',
    async ({ addressType, scope, expectedAssets }) => {
      const response = await snap.onKeyringRequest({
        origin,
        method: 'keyring_listAccountAssets',
        params: {
          id: accounts[`${addressType}:${scope}`].id,
        },
      });

      expect(response).toRespondWith(expectedAssets);
    },
  );
});
