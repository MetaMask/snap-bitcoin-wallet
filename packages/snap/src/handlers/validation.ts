import type { Network, AddressType } from '@metamask/bitcoindevkit';
import { Address, Amount } from '@metamask/bitcoindevkit';
import { BtcMethod } from '@metamask/keyring-api';
import { CaipAssetTypeStruct } from '@metamask/utils';
import type { Infer } from 'superstruct';
import {
  pattern,
  array,
  boolean,
  enums,
  literal,
  number,
  object,
  optional,
  string,
  nonempty,
  refine,
  union,
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
  SignProofOfOwnership = 'signProofOfOwnership',
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
 * Wallet account struct for Bitcoin requests.
 */
const WalletAccountStruct = object({
  address: string(),
});

export const FeeRateStruct = refine(
  number(),
  'fee rate greater than or equal to 1',
  (value) => Number.isFinite(value) && value >= 1,
);

export const SignPsbtRequest = object({
  account: WalletAccountStruct,
  psbt: string(),
  feeRate: optional(FeeRateStruct),
  options: object({
    fill: boolean(),
    broadcast: boolean(),
  }),
});

export const ComputeFeeRequest = object({
  account: WalletAccountStruct,
  psbt: string(),
  feeRate: optional(FeeRateStruct),
});

export const BroadcastPsbtRequest = object({
  account: WalletAccountStruct,
  psbt: string(),
});

export const FillPsbtRequest = object({
  account: WalletAccountStruct,
  psbt: string(),
  feeRate: optional(FeeRateStruct),
});

export const SendTransferRequest = object({
  account: WalletAccountStruct,
  recipients: array(
    object({
      address: string(),
      amount: string(),
    }),
  ),
  feeRate: optional(FeeRateStruct),
});

export const GetUtxoRequest = object({
  account: WalletAccountStruct,
  outpoint: string(),
});

export const SignMessageRequest = object({
  account: WalletAccountStruct,
  message: string(),
});

/**
 * Validates that a JsonRpcRequest is a valid Bitcoin request.
 *
 * TODO: update btc-methods.md to include all the new methods
 *
 * @see https://github.com/MetaMask/accounts/blob/main/packages/keyring-api/docs/btc-methods.md
 */
export const SignPsbtKeyringRequestStruct = object({
  method: literal(BtcMethod.SignPsbt),
  params: SignPsbtRequest,
});

export const FillPsbtKeyringRequestStruct = object({
  method: literal(BtcMethod.FillPsbt),
  params: FillPsbtRequest,
});

export const ComputeFeeKeyringRequestStruct = object({
  method: literal(BtcMethod.ComputeFee),
  params: ComputeFeeRequest,
});

export const BroadcastPsbtKeyringRequestStruct = object({
  method: literal(BtcMethod.BroadcastPsbt),
  params: BroadcastPsbtRequest,
});

export const SendTransferKeyringRequestStruct = object({
  method: literal(BtcMethod.SendTransfer),
  params: SendTransferRequest,
});

export const GetUtxoKeyringRequestStruct = object({
  method: literal(BtcMethod.GetUtxo),
  params: GetUtxoRequest,
});

export const SignMessageKeyringRequestStruct = object({
  method: literal(BtcMethod.SignMessage),
  params: SignMessageRequest,
});

export const BtcWalletRequestStruct = union([
  SignPsbtKeyringRequestStruct,
  FillPsbtKeyringRequestStruct,
  ComputeFeeKeyringRequestStruct,
  BroadcastPsbtKeyringRequestStruct,
  SendTransferKeyringRequestStruct,
  GetUtxoKeyringRequestStruct,
  SignMessageKeyringRequestStruct,
]);

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
      return 540n;
    case 'p2wsh':
      return 330n;
    case 'p2tr':
      return 330n;
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

export const PROOF_OF_OWNERSHIP_MESSAGE_PREFIX = 'metamask:proof-of-ownership:';

// bech32/bech32m HRPs for Bitcoin mainnet, testnet, and regtest. Addresses
// starting with one of these are case-insensitive but only canonical in
// lowercase.
const BECH32_BITCOIN_ADDRESS_PREFIXES = ['bc1', 'tb1', 'bcrt1'];

/**
 * Canonicalizes a Bitcoin address for equality comparison: bech32/bech32m
 * (P2WPKH, P2WSH, P2TR) are lowercased, legacy base58check (P2PKH, P2SH)
 * are passed through unchanged.
 *
 * @param address - The Bitcoin address to canonicalize
 * @returns The canonical form of the address
 */
export function canonicalizeBitcoinAddress(address: string): string {
  const lowercased = address.toLowerCase();
  if (
    BECH32_BITCOIN_ADDRESS_PREFIXES.some((hrp) => lowercased.startsWith(hrp))
  ) {
    return lowercased;
  }
  return address;
}

/**
 * Parses a plaintext proof-of-ownership message in the format 'metamask:proof-of-ownership:{nonce}:{address}'
 *
 * @param message - The plaintext message to parse
 * @returns Object containing the parsed nonce and address
 * @throws Error if the message format is invalid
 */
export function parseProofOfOwnershipMessage(message: string): {
  nonce: string;
  address: string;
} {
  if (!message.startsWith(PROOF_OF_OWNERSHIP_MESSAGE_PREFIX)) {
    throw new Error(
      `Message must start with "${PROOF_OF_OWNERSHIP_MESSAGE_PREFIX}"`,
    );
  }

  const remainder = message.slice(PROOF_OF_OWNERSHIP_MESSAGE_PREFIX.length);
  const separatorIdx = remainder.indexOf(':');
  if (separatorIdx === -1) {
    throw new Error(
      'Message must follow the format "metamask:proof-of-ownership:{nonce}:{address}"',
    );
  }

  const nonce = remainder.slice(0, separatorIdx);
  const address = remainder.slice(separatorIdx + 1);

  if (nonce === '') {
    throw new Error(
      'Proof-of-ownership message must contain a non-empty nonce',
    );
  }

  if (address === '') {
    throw new Error(
      'Proof-of-ownership message must contain a non-empty address',
    );
  }

  return { nonce, address };
}
