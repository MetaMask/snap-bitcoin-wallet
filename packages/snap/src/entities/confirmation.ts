import type { Network, Psbt } from '@metamask/bitcoindevkit';

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
  Confirm = 'confirmation-confirm',
  Cancel = 'confirmation-cancel',
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

  /**
   * Inserts a send transfer confirmation interface.
   *
   * @param account - The account sending the transfer.
   * @param psbt - The PSBT of the transfer.
   * @param recipient - The recipient of the transfer.
   * @param recipient.address - The address of the recipient.
   * @param recipient.amount - The amount to send to the recipient.
   * @param origin - The origin of the request.
   */
  insertSendTransfer(
    account: BitcoinAccount,
    psbt: Psbt,
    recipient: { address: string; amount: string },
    origin: string,
  ): Promise<void>;
};
