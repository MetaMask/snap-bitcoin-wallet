import { type Struct, assert } from 'superstruct';

import { logger } from '../modules/logger/logger';
import { SnapRpcError, SnapRpcValidationError } from './exceptions';
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

  static requestStruct: Struct = SnapRpcHandlerRequestStruct;

  abstract handleRequest(
    params: SnapRpcHandlerRequest,
  ): Promise<SnapRpcHandlerResponse>;

  abstract requestStruct: Struct;

  protected async validate(params: SnapRpcHandlerRequest): Promise<void> {
    assert(params, this.requestStruct);
  }

  protected async preExecute(params: SnapRpcHandlerRequest): Promise<void> {
    logger.info(
      `[SnapRpcHandler.preExecute] Request: ${JSON.stringify(params)}`,
    );
    try {
      await this.validate(params);
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
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[SnapRpcHandler.execute] Error: ${error.message}`);
      if (error instanceof SnapRpcValidationError) {
        throw error;
      }
      throw new SnapRpcError(error.message);
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
