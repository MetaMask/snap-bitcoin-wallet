import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';

const ACCOUNT_INDEX = 2;

describe('CronHandler', () => {
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
          index: ACCOUNT_INDEX,
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
        chain_id_caip: BtcScope.Regtest,
        account_type: BtcAccountType.P2wpkh,
        tx_id: txid,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });
});
