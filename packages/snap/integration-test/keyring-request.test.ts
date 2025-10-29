import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { assertIsConfirmationDialog, installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';
import { AccountCapability } from '../src/entities';
import type { FillPsbtResponse } from '../src/handlers/KeyringRequestHandler';

const ACCOUNT_INDEX = 3;
const submitRequestMethod = 'keyring_submitRequest';

describe('KeyringRequestHandler', () => {
  let account: KeyringAccount;
  let snap: Snap;
  let blockchain: BlockchainTestUtils;
  const origin = 'http://my-dapp.com';
  let createdAccountId: string | undefined;

  beforeAll(async () => {
    blockchain = new BlockchainTestUtils();
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });

    snap.mockJsonRpc((request) => {
      if (request.method === 'snap_manageAccounts') {
        const params = request.params as Record<string, unknown> | undefined;
        if (params && params.method === 'getSelectedAccounts') {
          return createdAccountId ? [createdAccountId] : [];
        }
        return null;
      }

      if (request.method === 'snap_trackError') {
        return {};
      }

      if (request.method === 'snap_scheduleBackgroundEvent') {
        return 'mock-event-id';
      }

      // no mocking for other methods
      return undefined;
    });

    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          synchronize: false,
          index: ACCOUNT_INDEX,
        },
      },
    });

    if ('result' in response.response) {
      account = response.response.result as KeyringAccount;
      createdAccountId = account.id;
    }

    await blockchain.sendToAddress(account.address, 10);
    await blockchain.mineBlocks(6);
    await snap.onCronjob({ method: 'synchronizeAccounts' });
  });

  it('fails if invalid params', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: submitRequestMethod,
      params: {
        id: account.id,
        origin,
        scope: BtcScope.Regtest,
        account: 'notAUUID',
        request: {
          method: AccountCapability.SignPsbt,
        },
      } as KeyringRequest,
    });

    expect(response).toRespondWithError({
      code: -32000,
      message:
        'Invalid format: At path: params.account -- Expected a value of type `UuidV4`, but received: `"notAUUID"`',
      stack: expect.anything(),
    });
  });

  it('fails if unrecognized method', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: submitRequestMethod,
      params: {
        id: account.id,
        origin,
        scope: BtcScope.Regtest,
        account: account.id,
        request: {
          method: 'invalidMethod',
        },
      } as KeyringRequest,
    });

    expect(response).toRespondWithError({
      code: -32601,
      data: {
        account: account.id,
        cause: null,
        method: 'invalidMethod',
      },
      message:
        'Method not implemented or not supported: Unrecognized Bitcoin account capability',
      stack: expect.anything(),
    });
  });

  // Keep order of tests as UTXOs are modified by other tests
  describe('UTXO management', () => {
    it('listUtxos', async () => {
      let response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.ListUtxos,
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: [
          {
            address: 'bcrt1qs2fj7czz0amfm74j73yujx6dn6223md56gkkuy',
            derivationIndex: 0,
            outpoint: expect.any(String),
            scriptPubkey:
              'OP_0 OP_PUSHBYTES_20 82932f60427f769dfab2f449c91b4d9e94a8edb4',
            scriptPubkeyHex: '001482932f60427f769dfab2f449c91b4d9e94a8edb4',
            value: '1000000000',
          },
        ],
      });

      const utxos = (
        response.response as { result: { result: { outpoint: string }[] } }
      ).result.result;

      response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.GetUtxo,
            params: {
              outpoint: utxos[0]?.outpoint,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: utxos[0],
      });
    });

    it('publicDescriptor', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.PublicDescriptor,
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result:
          "wpkh([27f9035f/84'/1'/0']tpubDCkv2fHDfPg5ok9EPv6CDozH72rvY2jgEPm79szMeBwCBwUf2T6n5nLrWFfhuuD48SgzrELezoiyDM9KbZaVen4wuuGwrqQANDhzB7E8yDh/0/*)#sx899xk6",
      });
    });
  });

  describe('signPsbt', () => {
    // PSBTs can be decoded here: https://bitcoincore.tech/apps/bitcoinjs-ui/index.html
    const TEMPLATE_PSBT =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bQAAAAAAAAAAAA=';
    const SIGNED_PSBT =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bQAAAAAAAAAAA==';

    it('signs a PSBT successfully: sign', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: false,
                broadcast: false,
              },
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: SIGNED_PSBT,
          txid: null,
        },
      });
    });

    it('signs a PSBT successfully: fill and sign', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: true,
                broadcast: false,
              },
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: expect.any(String), // non deterministic
          txid: null,
        },
      });
    });

    it('signs a PSBT successfully: fill, sign and broadcast', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: true,
                broadcast: true,
              },
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: expect.any(String), // non deterministic
          txid: expect.any(String),
        },
      });
    });

    it('fails if invalid PSBT', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: 'notAPsbt',
              options: {
                fill: true,
                broadcast: true,
              },
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWithError({
        code: -32000,
        message: 'Invalid format: Invalid PSBT',
        data: {
          cause: null,
          transaction: 'notAPsbt',
        },
        stack: expect.anything(),
      });
    });

    it('fails if missing options', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWithError({
        code: -32000,
        message:
          'Invalid format: At path: options -- Expected an object, but received: undefined',
        stack: expect.anything(),
      });
    });
  });

  describe('fillPsbt', () => {
    // PSBTs can be decoded here: https://bitcoincore.tech/apps/bitcoinjs-ui/index.html
    const TEMPLATE_PSBT =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bQAAAAAAAAAAAA=';

    it('fills a PSBT successfully', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.FillPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: expect.any(String), // non deterministic
        },
      });
    });

    it('fails if invalid PSBT', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.FillPsbt,
            params: {
              psbt: 'notAPsbt',
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWithError({
        code: -32000,
        message: 'Invalid format: Invalid PSBT',
        data: {
          cause: null,
          transaction: 'notAPsbt',
        },
        stack: expect.anything(),
      });
    });
  });

  describe('computeFee', () => {
    // PSBTs can be decoded here: https://bitcoincore.tech/apps/bitcoinjs-ui/index.html
    const TEMPLATE_PSBT =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bQAAAAAAAAAAAA=';

    it('computes the fee for a PSBT successfully', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.ComputeFee,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          fee: '632',
        },
      });
    });

    it('fails if invalid PSBT', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.ComputeFee,
            params: {
              psbt: 'notAPsbt',
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWithError({
        code: -32000,
        message: 'Invalid format: Invalid PSBT',
        data: {
          cause: null,
          transaction: 'notAPsbt',
        },
        stack: expect.anything(),
      });
    });
  });

  describe('broadcastPsbt', () => {
    // PSBTs can be decoded here: https://bitcoincore.tech/apps/bitcoinjs-ui/index.html
    const TEMPLATE_PSBT =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bQAAAAAAAAAAAA=';

    it('broadcasts a PSBT successfully', async () => {
      // Prepare the PSBT to broadcast so we have a valid PSBT to broadcast
      let response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: true,
                broadcast: false,
              },
            },
          },
        } as KeyringRequest,
      });

      const { result } = (
        response.response as { result: { result: FillPsbtResponse } }
      ).result;

      response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.BroadcastPsbt,
            params: {
              psbt: result.psbt,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: expect.any(String),
        },
      });
    });

    it('fails if invalid PSBT', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.BroadcastPsbt,
            params: {
              psbt: 'notAPsbt',
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWithError({
        code: -32000,
        message: 'Invalid format: Invalid PSBT',
        data: {
          cause: null,
          transaction: 'notAPsbt',
        },
        stack: expect.anything(),
      });
    });
  });

  describe('sendTransfer', () => {
    it('sends funds successfully', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SendTransfer,
            params: {
              recipients: [
                {
                  address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
                  amount: '1000',
                },
                {
                  address: 'bcrt1q4gfcga7jfjmm02zpvrh4ttc5k7lmnq2re52z2y',
                  amount: '1000',
                },
              ],
              feeRate: 3,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: expect.any(String),
        },
      });
    });

    it('fails if invalid recipients', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SendTransfer,
            params: {
              recipients: [{ address: 'notAnAddress', amount: '1000' }],
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWithError({
        code: -32602,
        data: { address: 'notAnAddress', amount: '1000', cause: null },
        message: 'Validation failed: Invalid recipient',
        stack: expect.anything(),
      });
    });
  });

  describe('signMessage', () => {
    it('signs a message successfully', async () => {
      const response = snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignMessage,
            params: {
              message: 'Hello, world!',
            },
          },
        } as KeyringRequest,
      });

      const ui = await response.getInterface();
      assertIsConfirmationDialog(ui);
      await ui.ok();

      const result = await response;

      expect(result).toRespondWith({
        pending: false,
        result: {
          signature:
            'AkcwRAIgZxodJQ60t9Rr/hABEHZ1zPUJ4m5hdM5QLpysH8fDSzgCIENOEuZtYf9/Nn/ZW15PcImkknol403dmZrgoOQ+6K+TASECwDKypXm/ElmVTxTLJ7nao6X5mB/iGbU2Q2qtot0QRL4=',
        },
      });
    });
  });
});
