import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

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
  const origin = 'integration-tests';

  beforeAll(async () => {
    blockchain = new BlockchainTestUtils();
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });

    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });
    snap.mockJsonRpc({ method: 'snap_trackError', result: {} });

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
        cause: null,
        id: expect.any(String),
        method: 'invalidMethod',
      },
      message:
        'Method not implemented or not supported: Unrecognized Bitcoin account capability',
      stack: expect.anything(),
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
});
