import type { Network, AddressType } from '@metamask/bitcoindevkit';
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
 * Returns the dust limit (in satoshis) for a given address type.
 *
 * @param addressType - The account address type (script type).
 * @returns The minimum spendable amount in satoshis for this script type.
 */
function getDustLimitSats(addressType: AddressType): bigint {
  switch (addressType) {
    case 'p2wpkh':
      return 294n;
    case 'p2pkh':
      return 546n;
    case 'p2sh':
      return 546n;
    case 'p2wsh':
      return 546n;
    case 'p2tr':
      return 546n;
    default:
      return 546n;
  }
}

/**
 * Validates that the amount is above the dust limit for the account's script type.
 *
 * @param amountInBtc - The amount to send, in BTC units.
 * @param account - The Bitcoin account providing address type and context.
 * @returns ValidationResponse indicating whether the amount meets dust requirements.
 */
export function validateDustLimit(
  amountInBtc: string,
  account: BitcoinAccount,
): ValidationResponse {
  const sats = Amount.from_btc(Number(amountInBtc)).to_sat();
  const min = getDustLimitSats(account.addressType);
  if (sats < min) {
    return { valid: false, errors: [{ code: SendErrorCodes.Invalid }] };
  }
  return NO_ERRORS_RESPONSE;
}
