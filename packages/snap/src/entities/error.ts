import type { Json } from '@metamask/utils';

export type CodifiedError = {
  message: string;
  code: number;
  data: Json;
};
