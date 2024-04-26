import { type Struct, assert } from 'superstruct';

import { logger } from '../modules/logger/logger';
import { compactError } from '../utils';
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
      throw new SnapRpcValidationError('Request params is invalid');
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
    try {
      await this.preExecute(params);
      const result = await this.handleRequest(params);
      await this.postExecute(result);
      return result;
    } catch (error) {
      throw compactError(error, SnapRpcValidationError);
    }
  }

  static getInstance(
    this: IStaticSnapRpcHandler,
    options?: SnapRpcHandlerOptions,
  ): ISnapRpcHandler {
    if (this.instance === null) {
      this.instance = new this(options);
    }
    return this.instance;
  }
}
