import { CaipAssetTypeStruct } from '@metamask/utils';
import type { Infer } from 'superstruct';
import { array, boolean, enums, object, string } from 'superstruct';

export enum SendErrorCodes {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Required = 'Required',
  Invalid = 'Invalid',
  InsufficientBalance = 'InsufficientBalance',
}

export const OnAddressInputRequestStruct = object({
  value: string(),
  accountId: string(),
});

export const OnAmountInputRequestStruct = object({
  value: string(),
  accountId: string(),
  assetId: CaipAssetTypeStruct,
});

export const ValidationResponseStruct = object({
  valid: boolean(),
  errors: array(
    object({
      code: enums(Object.values(SendErrorCodes)),
    }),
  ),
});

export const checkEmptyStringParams = (
  params: string[],
): ValidationResponse | null => {
  const anyInvalid = params
    .map((param) => param.trim())
    .find((value) => value === '');

  if (anyInvalid !== undefined) {
    return {
      valid: false,
      errors: [{ code: SendErrorCodes.Required }],
    };
  }

  return null;
};

export type ValidationResponse = Infer<typeof ValidationResponseStruct>;
