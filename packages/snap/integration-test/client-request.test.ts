import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN } from './constants';
import { TrackingSnapEvent } from '../src/entities';

const ACCOUNT_INDEX = 1;

describe('OnClientRequestHandler', () => {
  let account: KeyringAccount;
  let snap: Snap;
  let blockchain: BlockchainTestUtils;

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

  it('fills inputs, signs and sends an output-only PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'signAndSendTransaction',
      params: {
        accountId: account.id,
        transaction:
          'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=',
      },
    });

    expect(response).toRespondWith({
      transactionId: expect.any(String),
    });
    const { transactionId } = (
      response.response as { result: { transactionId: string } }
    ).result;

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(response).toTrackEvent({
      event: TrackingSnapEvent.TransactionSubmitted,
      properties: {
        account_address: account.address,
        account_id: account.id,
        account_type: BtcAccountType.P2wpkh,
        chain_id: BtcScope.Regtest,
        message: 'Snap transaction submitted',
        origin: ORIGIN,
        tx_id: transactionId,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    await blockchain.mineBlocks(6);

    // should now detect transaction as finalised
    const finalSyncResponse = await snap.onCronjob({
      method: 'synchronizeAccounts',
    });

    expect(finalSyncResponse).toRespondWith(null);

    /* eslint-disable @typescript-eslint/naming-convention */
    expect(finalSyncResponse).toTrackEvent({
      event: TrackingSnapEvent.TransactionFinalized,
      properties: {
        origin: 'cron',
        message: 'Snap transaction finalized',
        chain_id: BtcScope.Regtest,
        account_id: account.id,
        account_address: account.address,
        account_type: BtcAccountType.P2wpkh,
        tx_id: transactionId,
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });

  it('fails if incorrect PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'signAndSendTransaction',
      params: {
        accountId: account.id,
        transaction: 'notAPsbt',
      },
    });

    expect(response).toRespondWithError({
      code: -32000,
      message: 'Invalid format: Invalid PSBT',
      data: {
        accountId: account.id,
        cause: null,
        transaction: 'notAPsbt',
      },
      stack: expect.anything(),
    });
  });

  it('fails if missing params', async () => {
    const response = await snap.onClientRequest({
      method: 'signAndSendTransaction',
      params: {
        accountId: null,
      },
    });

    expect(response).toRespondWithError({
      code: -32000,
      message:
        'Invalid format: At path: accountId -- Expected a string, but received: null',
      stack: expect.anything(),
    });
  });

  it('computes fee for valid PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'computeFee',
      params: {
        account: account.id,
        transaction:
          'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=',
        scope: BtcScope.Regtest,
      },
    });

    expect(response).toRespondWith({
      fee: expect.arrayContaining([
        expect.objectContaining({
          type: 'base',
          asset: expect.objectContaining({
            unit: 'btc',
            type: expect.any(String),
            amount: expect.any(String),
            fungible: true,
          }),
        }),
      ]),
    });

    const { fee } = (
      response.response as {
        result: { fee: { asset: { amount: string } }[] };
      }
    ).result;

    expect(fee).toHaveLength(1);
    expect(fee[0]).toBeDefined();
    const firstFee = fee[0];
    expect(firstFee?.asset?.amount).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(parseFloat(firstFee!.asset.amount)).toBeGreaterThan(0);
  });

  it('fails to compute fee for invalid PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'computeFee',
      params: {
        account: account.id,
        transaction: 'notAPsbt',
        scope: BtcScope.Regtest,
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

  it('fails to compute fee if missing params', async () => {
    const response = await snap.onClientRequest({
      method: 'computeFee',
      params: {
        account: null,
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
