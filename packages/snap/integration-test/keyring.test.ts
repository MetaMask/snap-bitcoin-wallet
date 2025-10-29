import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import {
  FUNDING_TX,
  MNEMONIC,
  ORIGIN,
  TEST_ADDRESS_REGTEST,
  TEST_ADDRESS_MAINNET,
  scopeToCoinType,
  accountTypeToPurpose,
} from './constants';
import { AccountCapability, CurrencyUnit } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';

const ACCOUNT_INDEX = 0;

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
    snap.mockJsonRpc((request) => {
      if (request.method === 'snap_manageAccounts') {
        const params = request.params as Record<string, unknown> | undefined;
        if (params && params.method === 'getSelectedAccounts') {
          return [];
        }
        return null;
      }

      if (request.method === 'snap_trackError') {
        return {};
      }

      if (request.method === 'snap_scheduleBackgroundEvent') {
        return 'mock-event-id';
      }

      return undefined;
    });
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
        derivationPath: `m/84'/1'/${ACCOUNT_INDEX}'`,
      },
    ]);
  });

  it('creates discovered account', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          derivationPath: `m/84'/1'/${ACCOUNT_INDEX}'`,
          scope: BtcScope.Regtest,
          synchronize: true,
        },
      },
    });

    expect(response).toRespondWith({
      type: BtcAccountType.P2wpkh,
      id: expect.anything(),
      address: TEST_ADDRESS_REGTEST,
      options: {
        entropySource: 'm',
        entropy: {
          type: 'mnemonic',
          id: 'm',
          groupIndex: ACCOUNT_INDEX,
          derivationPath: `m/84'/1'/${ACCOUNT_INDEX}'`,
        },
        exportable: false,
      },
      scopes: [BtcScope.Regtest],
      methods: Object.values(AccountCapability),
    });

    // eslint-disable-next-line jest/no-conditional-in-test
    if ('result' in response.response) {
      accounts[TEST_ADDRESS_REGTEST] = response.response
        .result as KeyringAccount;

      await snap.onCronjob({
        method: 'fullScanAccount',
        params: { accountId: accounts[TEST_ADDRESS_REGTEST].id },
      });
    }
  });

  it.each([
    {
      // tests creation of multiple accounts of same address type and network
      addressType: BtcAccountType.P2wpkh,
      scope: BtcScope.Regtest,
      index: ACCOUNT_INDEX + 1, // index incremented by 1
      expectedAddress: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
    },
    {
      addressType: BtcAccountType.P2wpkh,
      scope: BtcScope.Mainnet,
      index: 0,
      expectedAddress: TEST_ADDRESS_MAINNET,
    },
  ])(
    'creates a P2WPKH account: %s',
    async ({ expectedAddress, ...requestOpts }) => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: 'keyring_createAccount',
        params: { options: { ...requestOpts, synchronize: false } },
      });

      expect(response).toRespondWith({
        type: requestOpts.addressType,
        id: expect.anything(),
        address: expectedAddress,
        options: {
          entropySource: 'm',
          entropy: {
            type: 'mnemonic',
            id: 'm',
            groupIndex: requestOpts.index,
            derivationPath: `m/${accountTypeToPurpose[requestOpts.addressType]}/${scopeToCoinType[requestOpts.scope]}/${requestOpts.index}'`,
          },
          exportable: false,
        },
        scopes: [requestOpts.scope],
        methods: Object.values(AccountCapability),
      });

      // eslint-disable-next-line jest/no-conditional-in-test
      if ('result' in response.response) {
        accounts[expectedAddress] = response.response.result as KeyringAccount;
      }
    },
  );

  // skip non-P2WPKH address types as we are not supporting them for v1
  it.skip.each([
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
      params: { options: { ...requestOpts, synchronize: false } },
    });

    expect(response).toRespondWith({
      type: requestOpts.addressType,
      id: expect.anything(),
      address: expectedAddress,
      options: {
        entropySource: 'm',
        entropy: {
          type: 'mnemonic',
          id: 'm',
          groupIndex: requestOpts.index,
          derivationPath: `m/${accountTypeToPurpose[requestOpts.addressType]}/${scopeToCoinType[requestOpts.scope]}/${requestOpts.index}'`,
        },
        exportable: false,
      },
      scopes: [requestOpts.scope],
      methods: Object.values(AccountCapability),
    });

    // eslint-disable-next-line jest/no-conditional-in-test
    if ('result' in response.response) {
      accounts[expectedAddress] = response.response.result as KeyringAccount;
    }
  });

  it('returns the same account if already exists by derivationPath', async () => {
    // Account already exists so we should get the same account
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh,
          derivationPath: "m/84'/1'/0'",
        },
      },
    });

    expect(response).toRespondWith(accounts[TEST_ADDRESS_REGTEST]);
  });

  it('returns the same account if already exists', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh,
          index: ACCOUNT_INDEX,
        },
      },
    });

    expect(response).toRespondWith(accounts[TEST_ADDRESS_REGTEST]);
  });

  it.each([
    {
      addressType: BtcAccountType.P2pkh,
      scope: BtcScope.Mainnet,
      expectedError: 'Only native segwit (P2WPKH) addresses are supported',
    },
    {
      addressType: BtcAccountType.P2sh,
      scope: BtcScope.Testnet,
      expectedError: 'Only native segwit (P2WPKH) addresses are supported',
    },
    {
      addressType: BtcAccountType.P2tr,
      scope: BtcScope.Mainnet,
      expectedError: 'Only native segwit (P2WPKH) addresses are supported',
    },
  ])(
    'rejects creation of non-P2WPKH account: $addressType',
    async ({ addressType, scope, expectedError }) => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: 'keyring_createAccount',
        params: {
          options: {
            scope,
            addressType,
            index: 0,
            synchronize: false,
          },
        },
      });

      expect(response.response).toMatchObject({
        error: {
          code: -32000,
          message: `Invalid format: ${expectedError}`,
        },
      });
    },
  );

  it.each([
    {
      derivationPath: "m/44'/0'/0'", // (P2PKH)
      expectedError:
        'Only native segwit (BIP-84) derivation paths are supported',
    },
    {
      derivationPath: "m/49'/0'/0'", // (P2SH)
      expectedError:
        'Only native segwit (BIP-84) derivation paths are supported',
    },
    {
      derivationPath: "m/86'/0'/0'", // (P2TR)
      expectedError:
        'Only native segwit (BIP-84) derivation paths are supported',
    },
  ])(
    'rejects creation with non-BIP84 derivation path: $derivationPath',
    async ({ derivationPath, expectedError }) => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: 'keyring_createAccount',
        params: {
          options: {
            scope: BtcScope.Regtest,
            derivationPath,
            synchronize: false,
          },
        },
      });

      expect(response.response).toMatchObject({
        error: {
          code: -32000,
          message: `Invalid format: ${expectedError}`,
        },
      });
    },
  );

  it('rejects creation when addressType and derivationPath mismatch', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh, // Native segwit
          derivationPath: "m/44'/0'/0'", // Legacy path (P2PKH)
          synchronize: false,
        },
      },
    });

    expect(response.response).toMatchObject({
      error: {
        code: -32000,
        message:
          'Invalid format: Only native segwit (BIP-84) derivation paths are supported',
      },
    });
  });

  it('accepts creation when addressType and derivationPath both indicate P2WPKH', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh,
          derivationPath: "m/84'/1'/10'", // Native segwit path matching P2WPKH
          synchronize: false,
        },
      },
    });

    expect(response.response).toHaveProperty('result');

    const account: KeyringAccount = (
      response.response as { result: KeyringAccount }
    ).result;
    expect(account.address).toMatch(/^bcrt1/u); // Native segwit address
    expect((account.options.entropy as { groupIndex: number }).groupIndex).toBe(
      10,
    );

    // remove to avoid interfering with other tests
    await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_deleteAccount',
      params: {
        id: account.id,
      },
    });
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

  it.each([
    {
      address: TEST_ADDRESS_REGTEST,
      expectedAssets: [Caip19Asset.Regtest],
    },
    {
      address: TEST_ADDRESS_MAINNET,
      expectedAssets: [Caip19Asset.Bitcoin],
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

  it('removes an account', async () => {
    const { id } = accounts[TEST_ADDRESS_REGTEST]!;

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
      code: -32001,
      message: `Resource not found: Account not found`,
      data: { id, cause: null },
      stack: expect.anything(),
    });
  });
});
