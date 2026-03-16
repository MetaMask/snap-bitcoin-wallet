import type { Network } from '@metamask/bitcoindevkit';
import { Address, Amount } from '@metamask/bitcoindevkit';
import { CaipAssetTypeStruct } from '@metamask/utils';
import type { Infer } from 'superstruct';
import {
  pattern,
  array,
  boolean,
  enums,
  object,
  string,
  nonempty,
  refine,
  is,
} from 'superstruct';

import type { BitcoinAccount, CodifiedError, Logger } from '../entities';
import { ValidationError } from '../entities';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
  SignAndSendTransaction = 'signAndSendTransaction',
  ComputeFee = 'computeFee',
  VerifyMessage = 'verifyMessage',
  OnAddressInput = 'onAddressInput',
  OnAmountInput = 'onAmountInput',
  ConfirmSend = 'confirmSend',
  SignRewardsMessage = 'signRewardsMessage',
}

export enum SendErrorCodes {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Required = 'Required',
  Invalid = 'Invalid',
  InsufficientBalance = 'InsufficientBalance',
  InsufficientBalanceToCoverFee = 'InsufficientBalanceToCoverFee',
}

export const NonEmptyStringStruct = refine(
  nonempty(string()),
  'non-whitespace string',
  (value) => value.trim().length > 0,
);

export const UuidStruct = pattern(
  NonEmptyStringStruct,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
);

export const OnAddressInputRequestStruct = object({
  value: NonEmptyStringStruct,
  accountId: UuidStruct,
});

export const OnAmountInputRequestStruct = object({
  value: NonEmptyStringStruct,
  accountId: UuidStruct,
  assetId: CaipAssetTypeStruct,
});

export const ConfirmSendRequestStruct = object({
  fromAccountId: UuidStruct,
  toAddress: NonEmptyStringStruct,
  assetId: CaipAssetTypeStruct,
  amount: NonEmptyStringStruct,
});

export const ValidationResponseStruct = object({
  valid: boolean(),
  errors: array(
    object({
      code: enums(Object.values(SendErrorCodes)),
    }),
  ),
});

export type ValidationResponse = Infer<typeof ValidationResponseStruct>;

// create constants for the two most common responses
export const INVALID_RESPONSE: ValidationResponse = {
  valid: false,
  errors: [{ code: SendErrorCodes.Invalid }],
};

export const NO_ERRORS_RESPONSE: ValidationResponse = {
  valid: true,
  errors: [],
};

/**
 * Validates that an amount is a positive number
 *
 * @param amount - The amount to validate
 * @returns ValidationResponse indicating if the amount is valid
 */
export function validateAmount(amount: string): ValidationResponse {
  const valueToNumber = Number(amount);
  if (!Number.isFinite(valueToNumber) || valueToNumber <= 0) {
    return INVALID_RESPONSE;
  }
  return NO_ERRORS_RESPONSE;
}

/**
 * Validates a Bitcoin address for a specific network
 *
 * @param address - The address to validate
 * @param network - The Bitcoin network
 * @param logger - Optional logger for error logging
 * @returns ValidationResponse indicating if the address is valid
 */
export function validateAddress(
  address: string,
  network: Network,
  logger?: Logger,
): ValidationResponse {
  try {
    Address.from_string(address, network).toString();
    return NO_ERRORS_RESPONSE;
  } catch (error) {
    if (logger) {
      logger.error(
        'Invalid address for network %s. Error: %s',
        network,
        (error as CodifiedError).message,
      );
    }
    return INVALID_RESPONSE;
  }
}

/**
 * Validates that an account has sufficient balance for a transaction
 *
 * @param amountInBtc - The amount in BTC
 * @param account - The Bitcoin account
 * @returns ValidationResponse indicating if the balance is sufficient
 */
export function validateAccountBalance(
  amountInBtc: string,
  account: BitcoinAccount,
): ValidationResponse {
  const balance = account.balance.trusted_spendable;
  const valueToNumber = Amount.from_btc(Number(amountInBtc));

  if (valueToNumber.to_sat() > balance.to_sat()) {
    return {
      valid: false,
      errors: [{ code: SendErrorCodes.InsufficientBalance }],
    };
  }

  return NO_ERRORS_RESPONSE;
}

/**
 * Validates that all account IDs are part of the existing accounts.
 *
 * @param accountIds - Set of account IDs to validate
 * @param existingAccountIds - Array of existing account IDs
 * @throws {ValidationError} If any account ID is not part of existing accounts
 */
export function validateSelectedAccounts(
  accountIds: Set<string>,
  existingAccountIds: string[],
): void {
  const isSubset = (first: Set<string>, second: Set<string>): boolean => {
    return Array.from(first).every((element) => second.has(element));
  };

  if (!isSubset(accountIds, new Set(existingAccountIds))) {
    throw new ValidationError(
      'Account IDs were not part of existing accounts.',
    );
  }
}

/**
 * Validates that the amount is above the dust limit for the account's script type.
 *
 * Uses BDK's `Amount.is_dust()` which computes the dust threshold from the actual
 * script, matching Bitcoin Core's relay policy exactly. This replaces the previous
 * hardcoded per-address-type dust limits.
 *
 * @param amountInBtc - The amount to send, in BTC units.
 * @param account - The Bitcoin account providing the public address and script.
 * @returns ValidationResponse indicating whether the amount meets dust requirements.
 */
export function validateDustLimit(
  amountInBtc: string,
  account: BitcoinAccount,
): ValidationResponse {
  const amount = Amount.from_btc(Number(amountInBtc));
  if (amount.is_dust(account.publicAddress.script_pubkey)) {
    return { valid: false, errors: [{ code: SendErrorCodes.Invalid }] };
  }
  return NO_ERRORS_RESPONSE;
}

export const PositiveNumberStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

/**
 * Parses a base64-encoded rewards message in the format 'rewards,{address},{timestamp}'
 *
 * @param base64Message - The base64-encoded message to parse
 * @returns Object containing the parsed address and timestamp
 * @throws Error if the message format is invalid
 */
export function parseRewardsMessage(base64Message: string): {
  address: string;
  timestamp: number;
} {
  // Decode the message from base64 to utf8
  let decodedMessage: string;
  try {
    decodedMessage = atob(base64Message);
  } catch {
    throw new Error('Invalid base64 encoding');
  }

  // Check if message starts with 'rewards,'
  if (!decodedMessage.startsWith('rewards,')) {
    throw new Error('Message must start with "rewards,"');
  }

  // Split the message into parts
  const parts = decodedMessage.split(',');
  if (parts.length !== 3) {
    throw new Error(
      'Message must have exactly 3 parts: rewards,{address},{timestamp}',
    );
  }

  const [prefix, addressPart, timestampPart] = parts;

  // Validate prefix (already checked above, but being explicit)
  if (prefix !== 'rewards') {
    throw new Error('Message must start with "rewards"');
  }

  // Validate timestamp
  if (!is(timestampPart, PositiveNumberStringStruct)) {
    throw new Error('Invalid timestamp format');
  }

  // Ensure timestamp is an integer (no decimals)
  if (timestampPart.includes('.')) {
    throw new Error('Invalid timestamp');
  }

  const timestamp = parseInt(timestampPart, 10);
  if (timestamp <= 0) {
    throw new Error('Invalid timestamp');
  }

  return {
    address: addressPart as string,
    timestamp,
  };
}
