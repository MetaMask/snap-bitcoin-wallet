import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';
import { TrackingSnapEvent } from '../src/entities';

const ACCOUNT_INDEX = 2;

describe('CronHandler', () => {
  let snap: Snap;
  let blockchain: BlockchainTestUtils;
  const accountsToSync: string[] = [];

  beforeAll(async () => {
    blockchain = new BlockchainTestUtils();
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });
  });

  beforeEach(() => {
    // clear accounts list before each test
    accountsToSync.length = 0;

    snap.mockJsonRpc((request) => {
      if (request.method === 'snap_manageAccounts') {
        const params = request.params as Record<string, unknown> | undefined;
        if (params && params.method === 'getSelectedAccounts') {
          return [...accountsToSync];
        }
        return null;
      }

      if (request.method === 'snap_trackError') {
        return {};
      }

      if (request.method === 'snap_scheduleBackgroundEvent') {
        return 'mock-event-id';
      }

      return undefined;
    });
  });

  it('should synchronize the account', async () => {
    // sanity test
    const response = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });
    expect(response).toBeDefined();
  });

  it('tracks TransactionReceived for new unconfirmed transaction with multiple syncs', async () => {
    // create account without initial sync
    const createResponse = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh,
          synchronize: false,
          index: ACCOUNT_INDEX,
        },
      },
    });

    expect(createResponse.response).toBeDefined();
    expect('result' in createResponse.response).toBe(true);

    const account = (createResponse.response as { result: KeyringAccount })
      .result;

    accountsToSync.push(account.id);

    // send a new transaction to the new account
    let txid = await blockchain.sendToAddress(account.address, 10);
    expect(txid).toBeDefined();

    // run cron sync to discover the unconfirmed transaction
    let syncResponse = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });
    expect(syncResponse).toRespondWith(null);

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(syncResponse).toTrackEvent({
      event: 'Transaction Received',
      properties: {
        origin: 'cron',
        message: 'Snap transaction received',
        chain_id_caip: BtcScope.Regtest,
        account_type: BtcAccountType.P2wpkh,
        tx_id: txid,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    // send a transaction to the account
    txid = await blockchain.sendToAddress(account.address, 5);
    expect(txid).toBeDefined();

    // sync using syncSelectedAccounts
    syncResponse = await snap.onCronjob({
      method: 'syncSelectedAccounts',
      params: { accountIds: [account.id] },
    });

    expect(syncResponse).toRespondWith(null);

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(syncResponse).toTrackEvent({
      event: TrackingSnapEvent.TransactionReceived,
      properties: {
        origin: 'metamask',
        message: 'Snap transaction received',
        chain_id_caip: BtcScope.Regtest,
        account_type: BtcAccountType.P2wpkh,
        tx_id: txid,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });
});
