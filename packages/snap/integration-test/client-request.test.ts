import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { MNEMONIC, ORIGIN } from './constants';
import { CurrencyUnit } from '../src/entities';
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

  it('fills, signs and sends a PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'fillAndSendPsbt',
      params: {
        account: account.id,
        psbt: 'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUktCU7U/5Wc13yO4MwPFZlWzcQRgAAAAAAAAAAAA=',
        feeRate: 5,
      },
    });

    console.log(response.response);

    expect(response).toRespondWith({
      txid: expect.any(String),
    });
  });
});
