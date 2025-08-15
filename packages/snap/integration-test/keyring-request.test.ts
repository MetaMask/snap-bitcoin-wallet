import type {
  KeyringAccount,
  KeyringRequest,
  SubmitRequestRequest,
} from '@metamask/keyring-api';
import { BtcScope } from '@metamask/keyring-api';
import type { Snap } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';

import { MNEMONIC, ORIGIN, TEST_ADDRESS_REGTEST } from './constants';
import { AccountCapability, CurrencyUnit } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';
import { BlockchainTestUtils } from './blockchain-utils';

const ACCOUNT_INDEX = 3;
const submitRequestMethod = 'keyring_submitRequest';

describe('KeyringRequestHandler', () => {
  let account: KeyringAccount;
  let snap: Snap;
  let blockchain: BlockchainTestUtils;
  const origin = 'integration-tests';

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

  beforeEach(() => {
    snap.mockJsonRpc({ method: 'snap_manageAccounts', result: {} });
    snap.mockJsonRpc({ method: 'snap_trackError', result: {} });
  });

  it('signPsbt', async () => {
    const response = await snap.onKeyringRequest({
      origin: ORIGIN,
      method: submitRequestMethod,
      params: {
        id: account.id,
        origin,
        scope: BtcScope.Regtest,
        account: account.address,
        request: {
          psbt: 'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=',
          method: AccountCapability.SignPsbt,
          params: {
            options: {
              fill: false,
              broadcast: false,
            },
          },
        },
      } as KeyringRequest,
    });

    expect(response).toRespondWith({
      psbt: 'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=',
      txid: null,
    });
  });
});
