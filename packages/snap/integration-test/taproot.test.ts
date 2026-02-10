import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { assertIsConfirmationDialog, installSnap } from '@metamask/snaps-jest';

import { BlockchainTestUtils } from './blockchain-utils';
import { MNEMONIC, ORIGIN, TEMPLATE_PSBT } from './constants';
import { getRequiredOutpoint } from './test-helpers';
import { AccountCapability } from '../src/entities';
import type { FillPsbtResponse } from '../src/handlers/KeyringRequestHandler';

const ACCOUNT_INDEX = 5; // Use different index to avoid conflicts with other tests
const submitRequestMethod = 'keyring_submitRequest';

describe('Taproot (P2TR) Integration Tests', () => {
  let account: KeyringAccount;
  let snap: Snap;
  let blockchain: BlockchainTestUtils;
  const origin = 'http://my-dapp.com';
  let createdAccountId: string | undefined;

  beforeAll(async () => {
    blockchain = new BlockchainTestUtils();
    snap = await installSnap({
      options: {
        secretRecoveryPhrase: MNEMONIC,
      },
    });

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

      if (request.method === 'snap_scheduleBackgroundEvent') {
        return 'mock-event-id';
      }

      return undefined;
    });

    // Create a P2TR (Taproot) account
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: 'keyring_createAccount',
      params: {
        options: {
          scope: BtcScope.Regtest,
          addressType: BtcAccountType.P2tr,
          synchronize: false,
          index: ACCOUNT_INDEX,
        },
      },
    });

    if ('result' in response.response) {
      account = response.response.result as KeyringAccount;
      createdAccountId = account.id;
    }

    // Fund the P2TR account
    await blockchain.sendToAddress(account.address, 10);
    await blockchain.mineBlocks(6);
    await snap.onCronjob({ method: 'synchronizeAccounts' });
  });

  describe('Account Creation', () => {
    it('creates a P2TR account with correct properties', () => {
      expect(account).toBeDefined();
      expect(account.type).toBe(BtcAccountType.P2tr);
      // Regtest Taproot addresses start with bcrt1p
      expect(account.address).toMatch(/^bcrt1p/u);
    });

    it('has correct derivation path for Taproot (BIP-86)', () => {
      const entropy = account.options.entropy as { derivationPath: string };
      // BIP-86 uses purpose 86' for Taproot
      expect(entropy.derivationPath).toMatch(/^m\/86'/u);
    });
  });

  describe('UTXO Management', () => {
    it('lists UTXOs for P2TR account', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.ListUtxos,
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: expect.arrayContaining([
          expect.objectContaining({
            address: expect.stringMatching(/^bcrt1p/u), // Taproot address
            value: '1000000000', // 10 BTC in sats
          }),
        ]),
      });
    });

    it('gets a specific UTXO for P2TR account', async () => {
      // First get the list of UTXOs
      let response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.ListUtxos,
          },
        },
      });

      const utxos = (
        response.response as { result: { result: { outpoint: string }[] } }
      ).result.result;
      const outpoint = getRequiredOutpoint(utxos);

      // Then get a specific UTXO
      response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.GetUtxo,
            params: {
              outpoint,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: expect.objectContaining({
          outpoint,
          address: expect.stringMatching(/^bcrt1p/u),
        }),
      });
    });

    it('returns correct Taproot descriptor', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.PublicDescriptor,
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        // Taproot descriptor starts with 'tr('
        result: expect.stringMatching(/^tr\(/u),
      });
    });
  });

  describe('PSBT Signing (Schnorr)', () => {
    it('fills a PSBT for P2TR account', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.FillPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: expect.any(String),
        },
      });
    });

    it('signs a PSBT with Schnorr signature (fill and sign)', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: true,
                broadcast: false,
              },
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: expect.any(String),
          txid: null,
        },
      });
    });

    it('signs and broadcasts a PSBT from P2TR account', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: true,
                broadcast: true,
              },
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          psbt: expect.any(String),
          txid: expect.any(String),
        },
      });

      // Mine blocks to confirm the transaction
      await blockchain.mineBlocks(1);
    });

    it('computes fee for P2TR transaction', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.ComputeFee,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          fee: expect.any(String),
        },
      });
    });
  });

  describe('Send Transfer', () => {
    it('sends funds from P2TR account to P2WPKH address', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SendTransfer,
            params: {
              recipients: [
                {
                  // P2WPKH address (bcrt1q...)
                  address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
                  amount: '1000',
                },
              ],
              feeRate: 3,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: expect.any(String),
        },
      });

      // Mine blocks to confirm
      await blockchain.mineBlocks(1);
    });

    it('sends funds from P2TR account to another P2TR address', async () => {
      // Generate a valid P2TR regtest address from the node
      const p2trRecipient = await blockchain.getNewAddress('bech32m');
      expect(p2trRecipient).toMatch(/^bcrt1p/u);

      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SendTransfer,
            params: {
              recipients: [
                {
                  address: p2trRecipient,
                  amount: '1000',
                },
              ],
              feeRate: 3,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: expect.any(String),
        },
      });

      // Mine blocks to confirm
      await blockchain.mineBlocks(1);
    });

    it('sends to multiple recipients from P2TR account', async () => {
      const response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SendTransfer,
            params: {
              recipients: [
                {
                  address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
                  amount: '500',
                },
                {
                  address: 'bcrt1q4gfcga7jfjmm02zpvrh4ttc5k7lmnq2re52z2y',
                  amount: '500',
                },
              ],
              feeRate: 3,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: expect.any(String),
        },
      });

      // Mine blocks to confirm
      await blockchain.mineBlocks(1);
    });
  });

  describe('Message Signing (BIP-322)', () => {
    it('signs a message with P2TR account using BIP-322', async () => {
      const response = snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignMessage,
            params: {
              message: 'Hello, Taproot!',
            },
          },
        },
      });

      const ui = await response.getInterface();
      assertIsConfirmationDialog(ui);
      await ui.ok();

      const result = await response;

      expect(result).toRespondWith({
        pending: false,
        result: {
          // BIP-322 signature for Taproot
          signature: expect.any(String),
        },
      });
    });

    it('signs an empty message with P2TR account', async () => {
      const response = snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignMessage,
            params: {
              message: '',
            },
          },
        },
      });

      const ui = await response.getInterface();
      assertIsConfirmationDialog(ui);
      await ui.ok();

      const result = await response;

      expect(result).toRespondWith({
        pending: false,
        result: {
          signature: expect.any(String),
        },
      });
    });
  });

  describe('Broadcast', () => {
    it('broadcasts a signed P2TR transaction', async () => {
      // First sign the PSBT without broadcasting
      let response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.SignPsbt,
            params: {
              psbt: TEMPLATE_PSBT,
              feeRate: 3,
              options: {
                fill: true,
                broadcast: false,
              },
            },
          },
        },
      });

      const { result } = (
        response.response as { result: { result: FillPsbtResponse } }
      ).result;

      // Then broadcast separately
      response = await snap.onKeyringRequest({
        origin: ORIGIN,
        method: submitRequestMethod,
        params: {
          id: account.id,
          origin,
          scope: BtcScope.Regtest,
          account: account.id,
          request: {
            method: AccountCapability.BroadcastPsbt,
            params: {
              psbt: result.psbt,
            },
          },
        },
      });

      expect(response).toRespondWith({
        pending: false,
        result: {
          txid: expect.any(String),
        },
      });
    });
  });
});
