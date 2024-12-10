import { enums, object, optional } from 'superstruct';
import { Caip2AddressType, Caip2ChainId } from './caip2';

export const CreateAccountRquest = object({
  scope: optional(enums(Object.values(Caip2ChainId))),
  addressType: optional(enums(Object.values(Caip2AddressType))),
});
