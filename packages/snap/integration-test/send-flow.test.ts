import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { assertIsCustomDialog, installSnap } from '@metamask/snaps-jest';

import { ReviewTransactionEvent, SendFormEvent } from '../src/entities';
import { Caip2AddressType } from '../src/handlers';
import { MNEMONIC } from './constants';

describe('Send flow', () => {
  const origin = 'metamask';
  const recipient = 'bcrt1qyvhf2epk9s659206lq3rdvtf07uq3t9e7xtjje';
  let account: KeyringAccount;
  let snap: Snap;

  beforeAll(async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });

    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });
    const response = await snap.onKeyringRequest({
      origin,
      method: 'keyring_createAccount',
      params: {
        options: {
          addressType: Caip2AddressType.P2wpkh,
          scope: BtcScope.Regtest,
          synchronize: true,
        },
      },
    });

    if ('result' in response.response) {
      account = response.response.result as KeyringAccount;
    }
  });

  it('handles user interactions', async () => {
    snap.mockJsonRpc({
      method: 'snap_scheduleBackgroundEvent',
      result: 'background-event-id',
    });

    const request = snap.request({
      origin,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });

    const sendFormUI = await request.getInterface();

    await sendFormUI.clickElement(SendFormEvent.SetMax);
    await sendFormUI.typeInField(SendFormEvent.Recipient, recipient);
    await sendFormUI.typeInField(SendFormEvent.Amount, '0.1');
    await sendFormUI.clickElement(SendFormEvent.Confirm);

    const reviewUI = await request.getInterface();
    await reviewUI.clickElement(ReviewTransactionEvent.HeaderBack);

    const ui = await request.getInterface();
    await ui.clickElement(SendFormEvent.Cancel);

    const result = await request;
    expect(result).toRespondWithError({
      code: 4001,
      message: 'User rejected the request.',
      stack: expect.anything(),
    });
  });

  it('complete send', async () => {
    snap.mockJsonRpc({
      method: 'snap_scheduleBackgroundEvent',
      result: 'background-event-id',
    });

    const response = snap.request({
      origin,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });

    let ui = await response.getInterface();
    assertIsCustomDialog(ui);

    await ui.typeInField(SendFormEvent.Amount, '0.1');
    await ui.typeInField(SendFormEvent.Recipient, recipient);
    await ui.clickElement(SendFormEvent.Confirm);

    ui = await response.getInterface();
    await ui.clickElement(ReviewTransactionEvent.Send);

    const result = await response;
    expect(result).toRespondWith({ txId: expect.any(String) });

    // TODO: To be improved once listAccountTransactions is implemented to check the tx confirmation status.
    const cronJobResponse = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });
    expect(cronJobResponse).toRespondWith(null);
  });
});
