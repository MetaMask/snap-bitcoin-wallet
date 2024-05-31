import { InvalidParamsError } from '@metamask/snaps-sdk';
import { type Struct, assert } from 'superstruct';

import { logger } from '../logger/logger';
import { InvalidSnapRpcResponseError } from './exceptions';
import {
  type SnapRpcHandlerOptions,
  type ISnapRpcHandler,
  type IStaticSnapRpcHandler,
  type SnapRpcHandlerResponse,
  type SnapRpcHandlerRequest,
  SnapRpcHandlerRequestStruct,
} from './types';

export abstract class BaseSnapRpcHandler {
  static instance: ISnapRpcHandler | null = null;

  static readonly requestStruct: Struct = SnapRpcHandlerRequestStruct;

  static readonly responseStruct?: Struct;

  protected isThrowValidationError = false;

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
      this.throwValidationError(error.message);
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
      throw new InvalidSnapRpcResponseError('Invalid Response');
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

  protected throwValidationError(message: string): void {
    throw new InvalidParamsError(
      this.isThrowValidationError ? message : undefined,
    ) as unknown as Error;
  }
}
