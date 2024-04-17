import { type Struct, assert } from 'superstruct';

import { logger } from '../modules/logger/logger';
import { SnapRpcRequestValidationError } from './exceptions';
import type {
  ISnapRpcValidator,
  ISnapRpcExecutable,
  SnapRpcRequestHandlerOptions,
  ISnapRpcRequestHandler,
  IStaticSnapRpcRequestHandler,
  SnapRpcRequestHandlerResponse,
  SnapRpcRequestHandlerRequest,
} from './types';

export abstract class BaseSnapRpcRequestHandler
  implements ISnapRpcValidator, ISnapRpcExecutable
{
  static instance: ISnapRpcRequestHandler | null = null;

  static validateStruct: Struct;

  abstract handleRequest(
    params: SnapRpcRequestHandlerRequest,
  ): Promise<SnapRpcRequestHandlerResponse>;

  abstract validateStruct: Struct;

  async validate(params: SnapRpcRequestHandlerRequest): Promise<void> {
    assert(params, this.validateStruct);
  }

  async preExecute(params: SnapRpcRequestHandlerRequest): Promise<void> {
    logger.info(`Request: ${JSON.stringify(params)}`);
    try {
      await this.validate(params);
    } catch (error) {
      throw new SnapRpcRequestValidationError(error);
    }
  }

  async postExecute(response: SnapRpcRequestHandlerResponse): Promise<void> {
    logger.info(`Response: ${JSON.stringify(response)}`);
  }

  async execute(
    params: SnapRpcRequestHandlerRequest,
  ): Promise<SnapRpcRequestHandlerResponse> {
    try {
      await this.preExecute(params);
      const result = await this.handleRequest(params);
      await this.postExecute(result);
      return result;
    } catch (error) {
      throw new SnapRpcRequestValidationError(error);
    }
  }

  static getInstance(
    this: IStaticSnapRpcRequestHandler,
    options?: SnapRpcRequestHandlerOptions,
  ): ISnapRpcRequestHandler {
    if (this.instance === null) {
      this.instance = new this(options);
    }
    return this.instance;
  }
}
