import type { Json } from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { enums, object, type Struct } from 'superstruct';

import { Chain, Config } from '../modules/config';

export const SnapRpcRequestHandlerRequestStruct = object({
  scope: enums(Config.avaliableNetworks[Chain.Bitcoin]),
});

export type SnapRpcRequestHandlerRequest = Infer<
  typeof SnapRpcRequestHandlerRequestStruct
>;

export type SnapRpcRequestHandlerResponse = Json;

export type SnapRpcRequestHandlerOptions = Json | null;

export type IStaticSnapRpcRequestHandler = {
  validateStruct: Struct;
  instance: ISnapRpcRequestHandler | null;
  new (options?: SnapRpcRequestHandlerOptions): ISnapRpcRequestHandler;
  getInstance(
    this: IStaticSnapRpcRequestHandler,
    options?: SnapRpcRequestHandlerOptions,
  ): ISnapRpcRequestHandler;
};

export type ISnapRpcValidator = {
  validate(params: SnapRpcRequestHandlerRequest): void;
};

export type ISnapRpcExecutable = {
  execute(
    params: SnapRpcRequestHandlerRequest,
  ): Promise<SnapRpcRequestHandlerResponse>;
};

export type ISnapRpcRequestHandler = {
  handleRequest(
    params: SnapRpcRequestHandlerRequest,
  ): Promise<SnapRpcRequestHandlerResponse>;
} & ISnapRpcExecutable;
