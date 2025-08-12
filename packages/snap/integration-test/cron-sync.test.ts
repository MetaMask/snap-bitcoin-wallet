import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';

describe('CronHandler Synchronization', () => {
  let snap: Snap;
  let blockchain: BlockchainTestUtils;

  beforeAll(async () => {
    blockchain = new BlockchainTestUtils();
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

  it('should synchronize the account', async () => {
    // sanity test
    const response = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });
    expect(response).toBeDefined();
  });

  it('tracks TransactionReceived for new unconfirmed transaction', async () => {
    // create account without initial sync
    const createResponse = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh,
          synchronize: false,
        },
      },
    });

    expect(createResponse.response).toBeDefined();
    expect('result' in createResponse.response).toBe(true);

    const account = (createResponse.response as { result: KeyringAccount })
      .result;

    // send a new transaction to the new account
    const txid = await blockchain.sendToAddress(account.address, 10);
    expect(txid).toBeDefined();

    // run cron sync to discover the unconfirmed transaction
    const syncResponse = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });
    expect(syncResponse).toRespondWith(null);

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(syncResponse).toTrackEvent({
      event: 'Transaction Received',
      properties: {
        origin: 'cron',
        message: 'Snap transaction received',
        chain_id: BtcScope.Regtest,
        account_id: account.id,
        account_address: account.address,
        account_type: BtcAccountType.P2wpkh,
        tx_id: txid,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });

  it('tracks TransactionFinalized when transaction gets confirmed', async () => {
    // new account to avoid potential flaky-ness and conflicts
    const createResponse = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2wpkh,
          index: 2,
          synchronize: false,
        },
      },
    });

    const account = (createResponse.response as { result: KeyringAccount })
      .result;

    const txid = await blockchain.sendToAddress(account.address, 25);

    // discover unconfirmed transaction
    await snap.onCronjob({
      method: 'synchronizeAccounts',
    });

    // mine blocks to confirm the transaction
    await blockchain.mineBlocks(6);

    // should now detect transaction as finalised
    const finalSyncResponse = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });

    expect(finalSyncResponse).toRespondWith(null);

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(finalSyncResponse).toTrackEvent({
      event: 'Transaction Finalized',
      properties: {
        origin: 'cron',
        message: 'Snap transaction finalized',
        chain_id: BtcScope.Regtest,
        account_id: account.id,
        account_address: account.address,
        account_type: BtcAccountType.P2wpkh,
        tx_id: txid,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });
});
