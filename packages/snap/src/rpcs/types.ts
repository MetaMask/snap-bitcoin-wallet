import type { Json } from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { object, type Struct } from 'superstruct';

import { scopeStruct } from '../utils';

export const SnapRpcHandlerRequestStruct = object({
  scope: scopeStruct,
});

export type SnapRpcHandlerRequest = Json &
  Infer<typeof SnapRpcHandlerRequestStruct>;

export type SnapRpcHandlerResponse = Json;

export type SnapRpcHandlerOptions = Record<string, Json> | null;

export type IStaticSnapRpcHandler = {
  requestStruct: Struct;
  reponseStruct?: Struct;
  instance: ISnapRpcHandler | null;
  new (options?: SnapRpcHandlerOptions): ISnapRpcHandler;
  getInstance(
    this: IStaticSnapRpcHandler,
    options?: SnapRpcHandlerOptions,
  ): ISnapRpcHandler;
};

export type ISnapRpcValidator = {
  validate(params: SnapRpcHandlerRequest): void;
};

export type ISnapRpcExecutable = {
  execute(params: SnapRpcHandlerRequest): Promise<SnapRpcHandlerResponse>;
};

export type ISnapRpcHandler = {
  handleRequest(params: SnapRpcHandlerRequest): Promise<SnapRpcHandlerResponse>;
} & ISnapRpcExecutable;
