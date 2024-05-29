import { BroadcastTransactionHandler } from './broadcast-transaction';
import { CreateAccountHandler } from './create-account';
import { EstimateFeesHandler } from './estimate-fees';
import { GetBalancesHandler } from './get-balances';
import { GetTransactionDataHandler } from './get-transaction-data';
import { GetTransactionStatusHandler } from './get-transaction-status';
import { RpcHelper } from './helpers';
import { SendManyHandler } from './sendmany';

describe('RpcHelper', () => {
  describe('getChainRpcApiHandlers', () => {
    it('returns handler', () => {
      expect(RpcHelper.getChainRpcApiHandlers()).toStrictEqual({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_createAccount: CreateAccountHandler,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_getBalances: GetBalancesHandler,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_broadcastTransaction: BroadcastTransactionHandler,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_getDataForTransaction: GetTransactionDataHandler,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_estimateFees: EstimateFeesHandler,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        chain_getTransactionStatus: GetTransactionStatusHandler,
      });
    });
  });

  describe('getKeyringRpcApiHandlers', () => {
    it('returns handler', () => {
      expect(RpcHelper.getKeyringRpcApiHandlers()).toStrictEqual({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        btc_sendmany: SendManyHandler,
      });
    });
  });
});
