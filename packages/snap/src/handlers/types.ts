import type { Infer } from 'superstruct';

import type {
  OnAddressInputRequestStruct,
  OnAmountInputRequestStruct,
} from './validation';

export type OnAddressInputRequest = Infer<typeof OnAddressInputRequestStruct>;
export type OnAmountInputRequest = Infer<typeof OnAmountInputRequestStruct>;
