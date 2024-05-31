import type { Json } from '@metamask/snaps-sdk';
import { object, type Struct, type Infer } from 'superstruct';

import { scopeStruct } from '../../utils';

export const SnapRpcHandlerRequestStruct = object({
  scope: scopeStruct,
});

export type SnapRpcHandlerRequest = Json &
  Infer<typeof SnapRpcHandlerRequestStruct>;

export type SnapRpcHandlerResponse = Json;

export type SnapRpcHandlerOptions = Record<string, Json> | null;

export type IStaticSnapRpcHandler = {
  /**
   * Superstruct for the request.
   */
  requestStruct: Struct;
  /**
   * Superstruct for the response.
   */
  reponseStruct?: Struct;

  /**
   * A method to create a new instance of the rpc handler.
   *
   * @param options - An optional parameter to create the instance.
   * @returns An handler object.
   */
  new (options?: SnapRpcHandlerOptions): ISnapRpcHandler;

  /**
   * A method to return the instance object of the rpc handler.
   *
   * @param this - The static instance of the handler class.
   * @param options - An optional parameter to create the instance.
   * @returns An handler object.
   */
  getInstance(
    this: IStaticSnapRpcHandler,
    options?: SnapRpcHandlerOptions,
  ): ISnapRpcHandler;
};

export type ISnapRpcHandler = {
  /**
   * A method to execute the rpc method.
   *
   * @param params - An struct contains the require parameter for the request.
   * @returns A promise that resolves to an json.
   */
  execute(params: SnapRpcHandlerRequest): Promise<SnapRpcHandlerResponse>;
};
