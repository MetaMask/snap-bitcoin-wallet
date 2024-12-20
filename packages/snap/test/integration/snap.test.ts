import { installSnap, Snap } from '@metamask/snaps-jest';
import { Caip2AddressType, Caip2ChainId } from '../../src/handlers';
import { BtcMethod, KeyringAccount } from '@metamask/keyring-api';

describe('Bitcoin Snap', () => {
  let snap: Snap;
  const accounts: Record<string, KeyringAccount> = {};
  const origin = 'metamask';

  it('should install the Snap successfully', async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase:
          'journey embrace permit coil indoor stereo welcome maid movie easy clock spider tent slush bright luxury awake waste legal modify awkward answer acid goose',
      },
    });
  });

  it('should create a default account', async () => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });

    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_createAccount',
      params: {
        options: {},
      },
    });

    expect(response).toRespondWith({
      type: Caip2AddressType.P2wpkh,
      id: expect.anything(),
      address: 'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
      options: {},
      methods: [BtcMethod.SendBitcoin],
    });
  });

  it.each([
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: Caip2ChainId.Bitcoin,
      expectedAddress: 'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: Caip2ChainId.Testnet,
      expectedAddress: 'tb1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgc26xfdz',
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: Caip2ChainId.Testnet4,
      expectedAddress: 'tb1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgc26xfdz',
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: Caip2ChainId.Signet,
      expectedAddress: 'tb1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgc26xfdz',
    },
    {
      addressType: Caip2AddressType.P2wpkh,
      scope: Caip2ChainId.Regtest,
      expectedAddress: 'tb1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgc26xfdz',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: Caip2ChainId.Bitcoin,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: Caip2ChainId.Testnet,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: Caip2ChainId.Testnet4,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: Caip2ChainId.Signet,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: Caip2AddressType.P2pkh,
      scope: Caip2ChainId.Regtest,
      expectedAddress: 'mjPQaLkhZN3MxsYN8Nebzwevuz8vdTaRCq',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: Caip2ChainId.Bitcoin,
      expectedAddress: 'tb1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: Caip2ChainId.Testnet,
      expectedAddress: 'tb1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: Caip2ChainId.Testnet4,
      expectedAddress: 'tb1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: Caip2ChainId.Signet,
      expectedAddress: 'tb1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2sh,
      scope: Caip2ChainId.Regtest,
      expectedAddress: 'tb1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: Caip2ChainId.Bitcoin,
      expectedAddress:
        'bc1p4rue37y0v9snd4z3fvw43d29u97qxf9j3fva72xy2t7hekg24dzsaz40mz',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: Caip2ChainId.Testnet,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: Caip2ChainId.Testnet4,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: Caip2ChainId.Signet,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
    },
    {
      addressType: Caip2AddressType.P2tr,
      scope: Caip2ChainId.Regtest,
      expectedAddress:
        'tb1pwwjax3vpq6h69965hcr22vkpm4qdvyu2pz67wyj8eagp9vxkcz0q0ya20h',
    },
  ])(
    'should create an account: %s',
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
        methods: [BtcMethod.SendBitcoin],
      });

      console.log(response.response);
      accounts[`${addressType}:${scope}`] = response.response
        .result as KeyringAccount;
    },
  );

  it('should return the same account if already exists', async () => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });

    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: Caip2ChainId.Bitcoin,
          addressType: Caip2AddressType.P2wpkh,
        },
      },
    });

    expect(response).toRespondWith(
      accounts[`${Caip2AddressType.P2wpkh}:${Caip2ChainId.Bitcoin}`],
    );
  });
});
