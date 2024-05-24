import type { Infer } from 'superstruct';
import { array, assign, number, object, string } from 'superstruct';

import { Factory } from '../factory';
import type { Utxo } from '../modules/bitcoin/wallet';
import {
  BaseSnapRpcHandler,
  SnapRpcHandlerRequestStruct,
} from '../modules/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerResponse,
} from '../modules/rpc';
import type { StaticImplements } from '../types/static';

export type GetTransactionDataParams = Infer<
  typeof GetTransactionDataHandler.requestStruct
>;

export type GetTransactionDataResponse = SnapRpcHandlerResponse &
  Infer<typeof GetTransactionDataHandler.responseStruct>;

export class GetTransactionDataHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof GetTransactionDataHandler>
{
  static override get requestStruct() {
    return assign(
      object({
        account: string(),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    return object({
      data: object({
        utxos: array(
          object({
            block: number(),
            txnHash: string(),
            index: number(),
            value: string(),
          }),
        ),
      }),
    });
  }

  async handleRequest(
    params: GetTransactionDataParams,
  ): Promise<GetTransactionDataResponse> {
    const chainApi = Factory.createOnChainServiceProvider(params.scope);

    const result = await chainApi.getDataForTransaction(params.account);

    const utoxs = result.data.utxos as unknown as Utxo[];

    return {
      data: {
        utxos: utoxs.map((utxo) => ({
          block: utxo.block,
          txnHash: utxo.txnHash,
          index: utxo.index,
          value: utxo.value.toString(),
        })),
      },
    };
  }
}
