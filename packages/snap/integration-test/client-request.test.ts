import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { MNEMONIC, ORIGIN, TEST_ADDRESS_REGTEST } from './constants';
import { CurrencyUnit, TrackingSnapEvent } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';

describe('Client requests', () => {
  let account: KeyringAccount;
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
    snap.mockJsonRpc({ method: 'snap_trackError', result: {} });
  });

  it('creates account', async () => {
    let response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          index: 0,
          scope: BtcScope.Regtest,
          synchronize: true,
        },
      },
    });

    expect(response).toBeDefined();

    // eslint-disable-next-line jest/no-conditional-in-test
    if ('result' in response.response) {
      account = response.response.result as KeyringAccount;
    }

    response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_getAccountBalances',
      params: {
        id: account.id,
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

  it('fills inputs, signs and sends an output-only PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'fillAndSendPsbt',
      params: {
        account: account.id,
        psbt: 'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUktCU7U/5Wc13yO4MwPFZlWzcQRgAAAAAAAAAAAA=',
        feeRate: 5,
      },
    });

    expect(response).toRespondWith({
      txid: expect.any(String),
    });
    const { txid } = (response.response as { result: { txid: string } }).result;

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(response).toTrackEvent({
      event: TrackingSnapEvent.TransactionSubmitted,
      properties: {
        account_address: TEST_ADDRESS_REGTEST,
        account_id: account.id,
        account_type: BtcAccountType.P2wpkh,
        chain_id: BtcScope.Regtest,
        message: 'Snap transaction submitted',
        origin: 'metamask',
        tx_id: txid,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });

  it('fails if incorrect PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'fillAndSendPsbt',
      params: {
        account: account.id,
        psbt: 'notAPsbt',
        feeRate: 5,
      },
    });

    expect(response).toRespondWithError({
      code: -32000,
      message: 'Invalid format: Invalid PSBT',
      data: {
        account: account.id,
        cause: null,
        psbtBase64: 'notAPsbt',
      },
      stack: expect.anything(),
    });
  });

  it('fails if missing params', async () => {
    const response = await snap.onClientRequest({
      method: 'fillAndSendPsbt',
      params: {
        account: null,
        feeRate: 5,
      },
    });

    expect(response).toRespondWithError({
      code: -32000,
      message:
        'Invalid format: At path: account -- Expected a string, but received: null',
      stack: expect.anything(),
    });
  });
});
