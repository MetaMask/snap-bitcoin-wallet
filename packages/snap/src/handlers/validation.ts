import { CaipAssetTypeStruct } from '@metamask/utils';
import type { Infer } from 'superstruct';
import { pattern, array, boolean, enums, object, string } from 'superstruct';

export enum SendErrorCodes {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Required = 'Required',
  Invalid = 'Invalid',
  InsufficientBalance = 'InsufficientBalance',
}

export const UuidStruct = pattern(
  string(),
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
);

export const OnAddressInputRequestStruct = object({
  value: string(),
  accountId: UuidStruct,
});

export const OnAmountInputRequestStruct = object({
  value: string(),
  accountId: UuidStruct,
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
