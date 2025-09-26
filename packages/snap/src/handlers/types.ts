import type { Infer } from 'superstruct';

import type {
  ConfirmSendRequestStruct,
  OnAddressInputRequestStruct,
  OnAmountInputRequestStruct,
} from './validation';

export type OnAddressInputRequest = Infer<typeof OnAddressInputRequestStruct>;
export type OnAmountInputRequest = Infer<typeof OnAmountInputRequestStruct>;
export type ConfirmSendRequest = Infer<typeof ConfirmSendRequestStruct>;
