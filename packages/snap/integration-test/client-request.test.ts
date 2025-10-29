import type { KeyringAccount } from '@metamask/keyring-api';
import { FeeType, BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN, TEST_ADDRESS_REGTEST } from './constants';
import { CurrencyUnit, TrackingSnapEvent } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';

const ACCOUNT_INDEX = 1;

describe('OnClientRequestHandler', () => {
  let account: KeyringAccount;
  let snap: Snap;
  let blockchain: BlockchainTestUtils;
  let createdAccountId: string | undefined;

  beforeAll(async () => {
    blockchain = new BlockchainTestUtils();
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });

    // mock snap_manageAccounts to handle different sub-methods
    snap.mockJsonRpc((request) => {
      if (request.method === 'snap_manageAccounts') {
        const params = request.params as Record<string, unknown> | undefined;
        if (params && params.method === 'getSelectedAccounts') {
          return createdAccountId ? [createdAccountId] : [];
        }
        return null;
      }

      if (request.method === 'snap_trackError') {
        return {};
      }

      if (request.method === 'snap_dialog') {
        return true;
      }

      if (request.method === 'snap_scheduleBackgroundEvent') {
        return 'mock-event-id';
      }

      // don't mock other methods
      return undefined;
    });

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
      createdAccountId = account.id;
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
        account_type: BtcAccountType.P2wpkh,
        chain_id_caip: BtcScope.Regtest,
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
        chain_id_caip: BtcScope.Regtest,
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
        accountId: account.id,
        transaction:
          'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=',
        scope: BtcScope.Regtest,
      },
    });

    expect(response).toRespondWith([
      {
        type: FeeType.Priority,
        asset: {
          unit: CurrencyUnit.Regtest,
          type: Caip19Asset.Regtest,
          amount: expect.stringContaining('0.00001'),
          fungible: true,
        },
      },
    ]);
  });

  it('fails to compute fee for invalid PSBT', async () => {
    const response = await snap.onClientRequest({
      method: 'computeFee',
      params: {
        accountId: account.id,
        transaction: 'notAPsbt',
        scope: BtcScope.Regtest,
      },
    });

    expect(response).toRespondWithError({
      code: -32000,
      message: 'Invalid format: Invalid PSBT',
      data: {
        cause: null,
        transaction: 'notAPsbt',
      },
      stack: expect.anything(),
    });
  });

  it('fails to compute fee if missing params', async () => {
    const response = await snap.onClientRequest({
      method: 'computeFee',
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

  it('validates a valid regtest address', async () => {
    const response = await snap.onClientRequest({
      method: 'onAddressInput',
      params: {
        value: TEST_ADDRESS_REGTEST,
        accountId: account.id,
      },
    });

    expect(response).toRespondWith({
      valid: true,
      errors: [],
    });
  });

  it('rejects an invalid address format', async () => {
    const response = await snap.onClientRequest({
      method: 'onAddressInput',
      params: {
        value: 'not-a-valid-bitcoin-address',
        accountId: account.id,
      },
    });

    expect(response).toRespondWith({
      valid: false,
      errors: [{ code: 'Invalid' }],
    });
  });

  it('rejects a testnet address when using regtest account', async () => {
    const response = await snap.onClientRequest({
      method: 'onAddressInput',
      params: {
        value: 'tb1qrn9d5qewjqq5syc4nrjprkfq8gge0cjdaznwcn', // testnet address (tb1)
        accountId: account.id, // regtest account
      },
    });

    expect(response).toRespondWith({
      valid: false,
      errors: [{ code: 'Invalid' }],
    });
  });

  it('missing accountId for onAddressInput', async () => {
    const response = await snap.onClientRequest({
      method: 'onAddressInput',
      params: {
        value: 'tb1qrn9d5qewjqq5syc4nrjprkfq8gge0cjdaznwcn',
      },
    });

    expect(response).toRespondWithError({
      code: -32000,
      message:
        'Invalid format: At path: accountId -- Expected a string, but received: undefined',
      stack: expect.anything(),
    });
  });

  describe('confirmSend', () => {
    it('creates a transaction without broadcasting', async () => {
      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: account.id,
          toAddress: TEST_ADDRESS_REGTEST,
          assetId: Caip19Asset.Regtest,
          amount: '0.001', // 0.001 BTC
        },
      });

      expect(response).toRespondWith({
        type: 'send',
        id: expect.any(String),
        account: account.id,
        chain: BtcScope.Regtest,
        status: 'unconfirmed',
        timestamp: expect.any(Number),
        events: [
          {
            status: 'unconfirmed',
            timestamp: expect.any(Number),
          },
        ],
        to: [
          {
            address: TEST_ADDRESS_REGTEST,
            asset: {
              amount: '0.001', // BTC amount
              fungible: true,
              unit: CurrencyUnit.Regtest,
              type: Caip19Asset.Regtest,
            },
          },
        ],
        from: [],
        fees: [
          {
            type: FeeType.Priority,
            asset: {
              amount: expect.any(String),
              fungible: true,
              unit: CurrencyUnit.Regtest,
              type: Caip19Asset.Regtest,
            },
          },
        ],
      });
    });

    it('fails with invalid account ID', async () => {
      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: 'not-a-uuid',
          toAddress: TEST_ADDRESS_REGTEST,
          assetId: Caip19Asset.Regtest,
          amount: '0.001',
        },
      });

      expect(response).toRespondWithError({
        code: -32000,
        message: expect.stringContaining('Expected a string matching'),
        stack: expect.anything(),
      });
    });

    it('fails with invalid address', async () => {
      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: account.id,
          toAddress: 'invalid-address',
          assetId: Caip19Asset.Regtest,
          amount: '0.001',
        },
      });

      expect(response).toRespondWith({
        errors: [{ code: 'Invalid' }],
        valid: false,
      });
    });

    it('fails with invalid amount', async () => {
      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: account.id,
          toAddress: TEST_ADDRESS_REGTEST,
          assetId: Caip19Asset.Regtest,
          amount: '-0.001', // negative amount
        },
      });

      expect(response).toRespondWith({
        errors: [{ code: 'Invalid' }],
        valid: false,
      });
    });

    it('fails with insufficient funds', async () => {
      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: account.id,
          toAddress: TEST_ADDRESS_REGTEST,
          assetId: Caip19Asset.Regtest,
          amount: '1000', // 1000 BTC - more than available
        },
      });

      expect(response).toRespondWith({
        errors: [{ code: 'InsufficientBalance' }],
        valid: false,
      });
    });

    it.skip('fails with insufficient funds to pay fees', async () => {
      // now with drainWallet in place this is not going to happen
      const balanceBtc = await blockchain.getBalanceInBTC(account.address);

      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: account.id,
          toAddress: TEST_ADDRESS_REGTEST,
          assetId: Caip19Asset.Regtest,
          amount: balanceBtc.toString(),
        },
      });

      expect(response).toRespondWith({
        errors: [{ code: 'InsufficientBalanceToCoverFee' }],
        valid: false,
      });
    });

    it('fails with missing parameters', async () => {
      const response = await snap.onClientRequest({
        method: 'confirmSend',
        params: {
          fromAccountId: account.id,
          // missing toAddress, assetId, amount
        } as any,
      });

      expect(response).toRespondWithError({
        code: -32000,
        message: expect.stringContaining('At path:'),
        stack: expect.anything(),
      });
    });
  });
});
