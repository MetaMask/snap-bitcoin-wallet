import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { assertIsCustomDialog, installSnap } from '@metamask/snaps-jest';

import { ReviewTransactionEvent, SendFormEvent } from '../src/entities';
import { Caip2AddressType } from '../src/handlers';
import { MNEMONIC } from './contants';

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

    snap.mockJsonRpc({
      method: 'snap_scheduleBackgroundEvent',
      result: 'background-event-id',
    });
    snap.mockJsonRpc({
      method: 'snap_cancelBackgroundEvent',
      result: null,
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

  it('happy path', async () => {
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
  });

  it('happy path drain account', async () => {
    const response = snap.request({
      origin,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });

    let ui = await response.getInterface();
    assertIsCustomDialog(ui);

    await ui.clickElement(SendFormEvent.SetMax);
    await ui.typeInField(SendFormEvent.Recipient, recipient);
    await ui.clickElement(SendFormEvent.Confirm);

    ui = await response.getInterface();
    await ui.clickElement(ReviewTransactionEvent.HeaderBack);

    ui = await response.getInterface();
    await ui.clickElement(SendFormEvent.Cancel);

    const result = await response;
    expect(result).toRespondWithError({
      code: 4001,
      message: 'User rejected the request.',
      stack: expect.anything(),
    });
  });

  it('cancel', async () => {
    const response = snap.request({
      origin,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });

    const ui = await response.getInterface();
    await ui.clickElement(SendFormEvent.Cancel);

    const result = await response;
    expect(result).toRespondWithError({
      code: 4001,
      message: 'User rejected the request.',
      stack: expect.anything(),
    });
  });

  it('revert back to send form', async () => {
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
    await ui.clickElement(ReviewTransactionEvent.HeaderBack);

    ui = await response.getInterface();
    await ui.clickElement(SendFormEvent.Cancel);

    const result = await response;
    expect(result).toRespondWithError({
      code: 4001,
      message: 'User rejected the request.',
      stack: expect.anything(),
    });
  });

  it('refresh rates', async () => {
    const response = snap.request({
      origin,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });

    let ui = await response.getInterface();

    // Only test that it executes successfully, checking actual values should be done in e2e tests
    // because we don't display exchange rates for testnets.
    const backgroundEventResponse = await snap.onBackgroundEvent({
      method: SendFormEvent.RefreshRates,
      params: {
        interfaceId: ui.id,
      },
    });
    expect(backgroundEventResponse).toRespondWith(null);

    ui = await response.getInterface();
    await ui.clickElement(SendFormEvent.Cancel);

    const result = await response;
    expect(result).toRespondWithError({
      code: 4001,
      message: 'User rejected the request.',
      stack: expect.anything(),
    });
  });

  // TODO: To be improved once listAccountTransactions is implemented to check the tx confirmation status.
  it('synchronize accounts via cronjob', async () => {
    const response = await snap.onCronjob({ method: 'synchronizeAccounts' });
    expect(response).toRespondWith(null);
  });
});
