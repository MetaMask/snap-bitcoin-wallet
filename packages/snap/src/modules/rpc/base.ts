import { InvalidParamsError } from '@metamask/snaps-sdk';
import { type Struct, assert } from 'superstruct';

import { logger } from '../logger/logger';
import { SnapRpcValidationError } from './exceptions';
import {
  type ISnapRpcExecutable,
  type SnapRpcHandlerOptions,
  type ISnapRpcHandler,
  type IStaticSnapRpcHandler,
  type SnapRpcHandlerResponse,
  type SnapRpcHandlerRequest,
  SnapRpcHandlerRequestStruct,
} from './types';

export abstract class BaseSnapRpcHandler implements ISnapRpcExecutable {
  static instance: ISnapRpcHandler | null = null;

  static readonly requestStruct: Struct = SnapRpcHandlerRequestStruct;

  static readonly responseStruct?: Struct;

  abstract handleRequest(
    params: SnapRpcHandlerRequest,
  ): Promise<SnapRpcHandlerResponse>;

  protected get requestStruct(): Struct {
    return (this.constructor as typeof BaseSnapRpcHandler).requestStruct;
  }

  protected get responseStruct(): Struct | undefined {
    return (this.constructor as typeof BaseSnapRpcHandler).responseStruct;
  }

  protected async preExecute(params: SnapRpcHandlerRequest): Promise<void> {
    logger.info(
      `[SnapRpcHandler.preExecute] Request: ${JSON.stringify(params)}`,
    );
    try {
      assert(params, this.requestStruct);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[SnapRpcHandler.preExecute] Error: ${error.message}`);
      throw new InvalidParamsError() as unknown as Error;
    }
  }

  protected async postExecute(response: SnapRpcHandlerResponse): Promise<void> {
    logger.info(
      `[SnapRpcHandler.postExecute] Response: ${JSON.stringify(response)}`,
    );

    try {
      if (this.responseStruct) {
        assert(response, this.responseStruct);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[SnapRpcHandler.postExecute] Error: ${error.message}`);
      throw new SnapRpcValidationError('Response is invalid');
    }
  }

  async execute(
    params: SnapRpcHandlerRequest,
  ): Promise<SnapRpcHandlerResponse> {
    await this.preExecute(params);
    const result = await this.handleRequest(params);
    await this.postExecute(result);
    return result;
  }

  static getInstance(
    this: IStaticSnapRpcHandler,
    options?: SnapRpcHandlerOptions,
  ): ISnapRpcHandler {
    return new this(options);
  }
}
