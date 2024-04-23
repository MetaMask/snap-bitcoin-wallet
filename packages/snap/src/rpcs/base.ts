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

abstract class Parent {
  static readonly staticMemeber: string;

  protected myProtectedMethod() {
    console.log((this.constructor as typeof Parent).staticMemeber);
  }
}

class Child extends Parent {
  static readonly staticMemeber = 'Hello, world!';

  public doSomething() {
    this.myProtectedMethod();
  }
}
new Child().doSomething();

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
    try {
      if (this.responseStruct) {
        assert(response, this.responseStruct);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[SnapRpcHandler.postExecute] Error: ${error.message}`);
      throw new SnapRpcValidationError('Response is invalid');
    }

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
