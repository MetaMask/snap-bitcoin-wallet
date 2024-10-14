import type { Json } from '@metamask/snaps-sdk';
import type { Struct } from 'superstruct';
import { mask } from 'superstruct';

import { compactError, logger } from '../../utils';
import { DataClientError } from './exceptions';

export type HttpRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
};

export type HttpResponse = globalThis.Response;

export abstract class ApiClient {
  /**
   * The name of the Api Client.
   */
  abstract apiClientName: string;

  /**
   * An abstract method that will be called in internal method `submitRequest`.
   * It is to verify and convert the http response to the Api response.
   *
   * @param response - The http response to verify
   * @returns A promise that resolves to the Api response.
   */
  protected abstract getResponse<ApiResponse>(
    response: HttpResponse,
  ): Promise<ApiResponse>;

  /**
   * An internal method to build the `RequestInfo` Object.
   *
   * @param params - The request parameters.
   * @param params.method - The http method, either GET or POST.
   * @param params.headers - The http headers.
   * @param params.url - The request url.
   * @param [params.body] - The request body.
   * @returns A `RequestInfo` Object.
   */
  protected buildRequest({
    method,
    headers = {},
    url,
    body,
  }: {
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    url: string;
    body?: Json;
  }): HttpRequest {
    const request = {
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: method === 'POST' && body ? JSON.stringify(body) : undefined,
    };

    return request;
  }

  /**
   * An internal method to submit the Api request.
   *
   * @param params - The request parameters.
   * @param [params.requestId] - The string id of the request.
   * @param params.request - The `RequestInfo` Object.
   * @param params.responseStruct - The superstruct to verify the Api response.
   * @returns A promise that resolves to a Json object.
   */
  protected async submitRequest<ApiResponse>({
    requestId = '',
    request,
    responseStruct,
  }: {
    requestId?: string;
    request: HttpRequest;
    responseStruct: Struct;
  }) {
    const logPrefix = `[${this.apiClientName}.${requestId}]`;

    try {
      logger.debug(`${logPrefix} request:`, `method - ${request.method}`);

      const fetchRequest = {
        method: request.method,
        headers: request.headers,
        body: request.body,
      };

      const httpResponse = await fetch(request.url, fetchRequest);

      const jsonResponse = await this.getResponse<ApiResponse>(httpResponse);

      logger.debug(`${logPrefix} response:`, JSON.stringify(jsonResponse));

      // Safeguard to identify if the response has some unexpected changes from the Api client
      mask(jsonResponse, responseStruct, `Unexpected response from Api client`);

      return jsonResponse;
    } catch (error) {
      logger.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `${logPrefix} error: ${error.message}`,
      );

      throw compactError(error, DataClientError);
    }
  }
}
