import { CreateAccountHandler } from './create-account';
import { GetBalancesHandler } from './get-balances';
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
