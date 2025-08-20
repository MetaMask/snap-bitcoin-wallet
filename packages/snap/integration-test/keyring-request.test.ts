import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';
import { AccountCapability } from '../src/entities';
import { FillPsbtResponse } from '../src/handlers/KeyringRequestHandler';

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
        'Invalid format: At path: params.account -- Expected a value of type `UuidV4`, but received: `\"notAUUID\"`',
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
        id: '7c5c5fbe-d952-46c3-b6ba-49953a0996fc',
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
    const FILLED_SIGNED_PSBT =
      'cHNidP8BALcCAAAAAZ5nWOH0vBxWPypyxG/94PhXZuJG03MZfxDyLe39lOx6AQAAAAD9////AzWDAQAAAAAAIlEg5E/U12KrfbmVIL+MwbRGWEBMdia65Qt9eAQdQze7mLgAAAAAAAAAADFqLwABRLH6L0iCDgdZ1ynJqAKzybO5EKSWADudEySbr2sAAAAAAAAAAAABAAIAAAAAU0SZOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttNgAAAAAAQDeAgAAAAABAd/1FS3FOxmNWE3dK+x+RZIofZ5Snh0GL4XGeI21K8RSAQAAAAD9////AkEka+4AAAAAFgAUiRc/AkxhTvmWMHzL8Lw02MP5TIkAypo7AAAAABYAFIKTL2BCf3ad+rL0SckbTZ6UqO20AkcwRAIgH4TWmM8ZBoOwFNWnCpUucAlyCLsa7AjGsw/v4V/uAWICICqkoTH7wDvnA9IE73DQI8APuRwiuVhRXuvwzz6s2x1PASECAahok/17/mrIXmYpPlhLfgYdIf288ODaZGSRURzOJL/SAAAAAQEfAMqaOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttAEIawJHMEQCIHfTCmqIPYkLj3cBJGTjROFFIwYX8ze+3gcUeYoKpx8WAiBz28G8UQLQPFuZuQZL9TQ3PWBOzoEcSbVMV1j/anJROQEhAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+AAAAAA==';

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
          psbt: FILLED_SIGNED_PSBT,
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
          psbt: FILLED_SIGNED_PSBT,
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
    const FILLED_PSBT =
      'cHNidP8BALcCAAAAAXTckYZCO+HE3Ub1I4Z2dGU6/QvwvuATS+PWhmXbtWVmAgAAAAD9////AzWDAQAAAAAAIlEg5E/U12KrfbmVIL+MwbRGWEBMdia65Qt9eAQdQze7mLgAAAAAAAAAADFqLwABRLH6L0iCDgdZ1ynJqAKzybO5EKSWADudEySbr2sAAAAAAAAAAAABAAIAAAAApr6XOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttNgAAAAAAQD9JAECAAAAAAEBnmdY4fS8HFY/KnLEb/3g+Fdm4kbTcxl/EPIt7f2U7HoBAAAAAP3///8DNYMBAAAAAAAiUSDkT9TXYqt9uZUgv4zBtEZYQEx2JrrlC314BB1DN7uYuAAAAAAAAAAAMWovAAFEsfovSIIOB1nXKcmoArPJs7kQpJYAO50TJJuvawAAAAAAAAAAAAEAAgAAAABTRJk7AAAAABYAFIKTL2BCf3ad+rL0SckbTZ6UqO20AkcwRAIgd9MKaog9iQuPdwEkZONE4UUjBhfzN77eBxR5igqnHxYCIHPbwbxRAtA8W5m5Bkv1NDc9YE7OgRxJtUxXWP9qclE5ASECwDKypXm/ElmVTxTLJ7nao6X5mB/iGbU2Q2qtot0QRL7YAAAAAQEfU0SZOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttCIGAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+GCf5A19UAACAAQAAgAAAAIAAAAAAAAAAAAAAACICAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+GCf5A19UAACAAQAAgAAAAIAAAAAAAAAAAAA=';

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
          psbt: FILLED_PSBT,
          txid: null,
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
          fee: 632,
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

  describe.only('broadcastPsbt', () => {
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
            method: AccountCapability.FillPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
            },
          },
        } as KeyringRequest,
      });

      const { psbt } = (response.response as { result: { psbt: string } })
        .result;

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
              psbt,
            },
          },
        } as KeyringRequest,
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: 'txid',
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
