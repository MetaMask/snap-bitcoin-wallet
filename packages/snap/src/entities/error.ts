import type { BdkErrorCode } from '@metamask/bitcoindevkit';
import type { Json } from '@metamask/utils';

export type CreateTxError = {
  message: string;
  code: BdkErrorCode | 'unknown';
  data: Json;
};
