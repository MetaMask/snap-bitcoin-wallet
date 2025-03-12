import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { assertIsCustomDialog, installSnap } from '@metamask/snaps-jest';

import {
  CurrencyUnit,
  ReviewTransactionEvent,
  SendFormEvent,
} from '../src/entities';
import { Caip19Asset, Caip2AddressType } from '../src/handlers/caip';
import { FUNDING_TX, MNEMONIC, ORIGIN } from './constants';

describe('Send flow', () => {
  const recipient = 'bcrt1qyvhf2epk9s659206lq3rdvtf07uq3t9e7xtjje';
  const sendAmount = '0.1';

  let account: KeyringAccount;
  let snap: Snap;

  beforeAll(async () => {
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });

    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });
    snap.mockJsonRpc({
      method: 'snap_scheduleBackgroundEvent',
      result: 'background-event-id',
    });
    snap.mockJsonRpc({
      method: 'snap_cancelBackgroundEvent',
      result: {},
    });

    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
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

  it('sends a transaction', async () => {
    const response = snap.request({
      origin: ORIGIN,
      method: 'startSendTransactionFlow',
      params: {
        account: account.id,
      },
    });
    let ui = await response.getInterface();
    assertIsCustomDialog(ui);

    // Perform user interactions.
    await ui.clickElement(SendFormEvent.SetMax);
    await ui.typeInField(SendFormEvent.Recipient, recipient);
    await ui.typeInField(SendFormEvent.Amount, sendAmount);

    const backgroundEventResponse = await snap.onBackgroundEvent({
      method: SendFormEvent.RefreshRates,
      params: { interfaceId: ui.id },
    });
    expect(backgroundEventResponse).toRespondWith(null);

    ui = await response.getInterface();
    await ui.clickElement(SendFormEvent.Confirm);

    // Test that we can successfully revert to send form.
    ui = await response.getInterface();
    await ui.clickElement(ReviewTransactionEvent.HeaderBack);

    ui = await response.getInterface();
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

    const listTxsResponse = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_listAccountTransactions',
      params: {
        id: account.id,
        pagination: { limit: 10, next: null },
      },
    });

    expect(listTxsResponse).toRespondWith({
      data: [
        { ...FUNDING_TX, account: account.id },
        {
          account: account.id,
          chain: BtcScope.Regtest,
          events: [{ status: 'unconfirmed', timestamp: 1741784431 }],
          fees: [
            {
              asset: {
                amount: expect.any(String),
                fungible: true,
                type: Caip19Asset.Regtest,
                unit: CurrencyUnit.Regtest,
              },
              type: 'priority',
            },
          ],
          from: [],
          id: expect.any(String),
          status: 'unconfirmed',
          timestamp: expect.any(Number),
          to: [
            {
              address: recipient,
              asset: {
                amount: sendAmount,
                fungible: true,
                type: Caip19Asset.Regtest,
                unit: CurrencyUnit.Regtest,
              },
            },
          ],
          type: 'send',
        },
      ],
      next: null,
    });
  });

  it('cancels by return button', async () => {
    const response = snap.request({
      origin: ORIGIN,
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
});
