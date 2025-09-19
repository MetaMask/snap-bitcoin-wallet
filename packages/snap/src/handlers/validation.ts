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

export enum SendErrorCodes {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Required = 'Required',
  Invalid = 'Invalid',
  InsufficientBalance = 'InsufficientBalance',
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

export const ValidationResponseStruct = object({
  valid: boolean(),
  errors: array(
    object({
      code: enums(Object.values(SendErrorCodes)),
    }),
  ),
});

export type ValidationResponse = Infer<typeof ValidationResponseStruct>;
