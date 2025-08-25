import type { Network } from '@metamask/bitcoindevkit';

import type { BitcoinAccount } from './account';

export type SignMessageConfirmationContext = {
  message: string;
  account: {
    id: string;
    address: string; // FIXME: Address should not be needed to identify an account
  };
  network: Network;
  origin: string;
};

export enum ConfirmationEvent {
  Confirm = 'confirm',
  Cancel = 'cancel',
}

/**
 * ConfirmationRepository is a repository that manages request confirmations for dApps.
 */
export type ConfirmationRepository = {
  /**
   * Inserts a sign message confirmation interface.
   *
   * @param account - The account to sign the message.
   * @param message - The message to sign.
   * @param origin - The origin of the request.
   */
  insertSignMessage(
    account: BitcoinAccount,
    message: string,
    origin: string,
  ): Promise<void>;
};
