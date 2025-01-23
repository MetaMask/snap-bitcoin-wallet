import { KeyringEvent } from '@metamask/keyring-api';
import { emitSnapKeyringEvent } from '@metamask/keyring-snap-sdk';

import type { BitcoinAccount } from '../../entities';
import type { EventEmitter } from '../../entities/snap';
import { snapToKeyringAccount } from '../../handlers/keyring-account';

export class SnapEventEmitterAdapter implements EventEmitter {
  async accountCreated(account: BitcoinAccount): Promise<void> {
    const suggestedName = () => {
      switch (account.network) {
        case 'bitcoin':
          return 'Bitcoin Account';
        case 'testnet':
          return 'Bitcoin Testnet Account';
        default:
          // Leave it blank to fallback to auto-suggested name on the extension side
          return '';
      }
    };

    return emitSnapKeyringEvent(snap, KeyringEvent.AccountCreated, {
      account: snapToKeyringAccount(account),
      accountNameSuggestion: suggestedName(),
    });
  }

  async accountDeleted(id: string): Promise<void> {
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountDeleted, {
      id,
    });
  }
}
