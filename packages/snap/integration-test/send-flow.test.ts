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

  it('user interactions', async () => {
    snap.mockJsonRpc({
      method: 'snap_scheduleBackgroundEvent',
      result: 'background-event-id',
    });

    snap.mockJsonRpc({
      method: 'snap_cancelBackgroundEvent',
      result: null,
    });

    const response = snap.request({
      origin,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });

    let ui = await response.getInterface();

    await ui.clickElement(SendFormEvent.SetMax);
    await ui.typeInField(SendFormEvent.Recipient, recipient);
    await ui.typeInField(SendFormEvent.Amount, '0.1');
    await ui.clickElement(SendFormEvent.Confirm);

    ui = await response.getInterface();
    await ui.clickElement(ReviewTransactionEvent.HeaderBack);

    ui = await response.getInterface();
    const backgroundEventResponse = await snap.onBackgroundEvent({
      method: SendFormEvent.RefreshRates,
      params: { interfaceId: ui.id },
    });
    expect(backgroundEventResponse).toRespondWith(null);
  });
});
