import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';
import { AccountCapability } from '../src/entities';

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
      code: -32000,
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
      'cHNidP8BALcCAAAAAXowAo4WtyEWrlbJWwvqZQfu1vCs+FS/sS/U72uMiFBUAAAAAAD9////AzWDAQAAAAAAIlEg5E/U12KrfbmVIL+MwbRGWEBMdia65Qt9eAQdQze7mLgAAAAAAAAAADFqLwABRLH6L0iCDgdZ1ynJqAKzybO5EKSWADudEySbr2sAAAAAAAAAAAABAAIAAAAAU0SZOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttNgAAAAAAQDeAgAAAAABAasVET1azMoYKdrlvyfJ2YZpixXNyj5eC25bAHGuTRiRAAAAAAD9////AgDKmjsAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bRBJGvuAAAAABYAFAvNIm4ZL1Dm8Yd5YePR0ZGRgJp4AkcwRAIgW2n3dDtsVkFB3zZzIZuUGb6MFH1O9xO6Xv9S6Uxy458CICyN4iq1hmXuOC8ZJWEkVtsy4klcoOv5d4pH/fjGEMQmASECjDm32fzVK88nMpgPReFayVDDZ1yJQ+WZEKHHwQeqdxzSAAAAAQEfAMqaOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttAEIawJHMEQCIH+Iq9/M7Wx2f5U+FHXW8xY64if5ebNNRfewdokw4id2AiAfK7YsMrcvgKA5lhHirFMf3jx4gS0rTAJ9AOK73TS/UQEhAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+AAAAAA==';

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
        data: {
          cause: null,
          transaction: 'notAPsbt',
        },
        stack: expect.anything(),
      });
    });
  });

  describe('fillPsbt', () => {
    // PSBTs can be decoded here: https://bitcoincore.tech/apps/bitcoinjs-ui/index.html
    const TEMPLATE_PSBT =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgpMvYEJ/dp36svRJyRtNnpSo7bQAAAAAAAAAAAA=';
    const FILLED_PSBT =
      'cHNidP8BALcCAAAAAcuHOtxdZAo5M19wIq7q96kGcc1ihw5LkB2BTKqpUcM3AgAAAAD9////AzWDAQAAAAAAIlEg5E/U12KrfbmVIL+MwbRGWEBMdia65Qt9eAQdQze7mLgAAAAAAAAAADFqLwABRLH6L0iCDgdZ1ynJqAKzybO5EKSWADudEySbr2sAAAAAAAAAAAABAAIAAAAApr6XOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttNgAAAAAAQD9JAECAAAAAAEBejACjha3IRauVslbC+plB+7W8Kz4VL+xL9Tva4yIUFQAAAAAAP3///8DNYMBAAAAAAAiUSDkT9TXYqt9uZUgv4zBtEZYQEx2JrrlC314BB1DN7uYuAAAAAAAAAAAMWovAAFEsfovSIIOB1nXKcmoArPJs7kQpJYAO50TJJuvawAAAAAAAAAAAAEAAgAAAABTRJk7AAAAABYAFIKTL2BCf3ad+rL0SckbTZ6UqO20AkcwRAIgf4ir38ztbHZ/lT4UddbzFjriJ/l5s01F97B2iTDiJ3YCIB8rtiwyty+AoDmWEeKsUx/ePHiBLStMAn0A4rvdNL9RASECwDKypXm/ElmVTxTLJ7nao6X5mB/iGbU2Q2qtot0QRL7YAAAAAQEfU0SZOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttCIGAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+GCf5A19UAACAAQAAgAAAAIAAAAAAAAAAAAAAACICAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+GCf5A19UAACAAQAAgAAAAIAAAAAAAAAAAAA=';

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
          fee: 1300,
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
    const FILLED_SIGNED_PSBT =
      'cHNidP8BALcCAAAAARfw/oa746JpyuFVgph6sl24ALLQdq+ZLOi+78lQWVyrAQAAAAD9////AzWDAQAAAAAAIlEg5E/U12KrfbmVIL+MwbRGWEBMdia65Qt9eAQdQze7mLgAAAAAAAAAADFqLwABRLH6L0iCDgdZ1ynJqAKzybO5EKSWADudEySbr2sAAAAAAAAAAAABAAIAAAAAU0SZOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttNgAAAAAAQDeAgAAAAABARbi9PHrzpuGqW9QkB0+7BbKMBYGUhNNEWi7Q4gHaU/MAAAAAAD9////AkEka+4AAAAAFgAUyOKDvSXiMienI279TDB+Va+yBYIAypo7AAAAABYAFIKTL2BCf3ad+rL0SckbTZ6UqO20AkcwRAIgRwpLLy3Qh6Dmpn6NK1oaRTI1aDGgyqU+OKFvE8uX8U0CICyFjM19u+3YM3XxYUCIaOc+ZT9W0hg1DWCS1ZnWDxLEASECWKUIwQrUyd91wlvpqefRzZgFo+eus+41HSd1J+nBcGecAAAAAQEfAMqaOwAAAAAWABSCky9gQn92nfqy9EnJG02elKjttAEIawJHMEQCICXIhfwxOBCEUMQK26K2a2tz+HwH60Vos+RGAL6w53GWAiBJhgi/Q7ohz6iOsc25ljps8XrUk7hurH83p5/FAyOoDQEhAsAysqV5vxJZlU8Uyye52qOl+Zgf4hm1NkNqraLdEES+AAAAAA==';

    it('broadcasts a PSBT successfully', async () => {
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
              psbt: FILLED_SIGNED_PSBT,
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
