import type { DialogResult } from '@metamask/snaps-sdk';
import { v4 as uuidv4 } from 'uuid';

import type { UIClient } from '../../entities';
import {
  TransactionStatus,
  type BitcoinAccount,
  type TransactionRequest,
} from '../../entities';
import { networkToCaip2 } from '../../handlers/caip2';
import { snapToKeyringAccount } from '../../handlers/keyring-account';
import { SendFlow } from '../../ui/components';

export class SnapUIClientAdapter implements UIClient {
  async dialog(id: string): Promise<DialogResult> {
    return await snap.request({
      method: 'snap_dialog',
      params: {
        id,
      },
    });
  }

  async createTransactionRequest(
    account: BitcoinAccount,
    request: TransactionRequest,
  ): Promise<string> {
    const requestId = uuidv4();
    const keyringAccount = snapToKeyringAccount(account);
    const scope = networkToCaip2[account.network];

    return await snap.request({
      method: 'snap_createInterface',
      params: {
        ui: (
          <SendFlow
            account={keyringAccount}
            sendFlowParams={{
              ...request,
            }}
          />
        ),
        context: {
          requestId,
          accounts: [keyringAccount],
          scope,
          request: {
            id: requestId,
            interfaceId: '', // to be set in the next update
            account: keyringAccount,
            transaction: {},
            status: TransactionStatus.Draft,
            ...request,
          },
        },
      },
    });
  }
}
