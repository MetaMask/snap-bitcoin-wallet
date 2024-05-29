import { InvalidParamsError } from '@metamask/snaps-sdk';

import {
  generateAccounts,
  generateBlockChairGetUtxosResp,
} from '../../test/utils';
import { Factory } from '../factory';
import { Network } from '../modules/bitcoin/constants';
import { GetTransactionDataHandler } from './get-transaction-data';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GetTransactionDataHandler', () => {
  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getDataForTransactionSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        estimateFees: jest.fn(),
        getBalances: jest.fn(),
        broadcastTransaction: jest.fn(),
        listTransactions: jest.fn(),
        getTransactionStatus: jest.fn(),
        getDataForTransaction: getDataForTransactionSpy,
      });
      return {
        getDataForTransactionSpy,
      };
    };

    it('returns correct result', async () => {
      const { getDataForTransactionSpy } = createMockChainApiFactory();
      const accounts = generateAccounts(2);
      const sender = accounts[0].address;
      const mockResponse = generateBlockChairGetUtxosResp(sender, 10);
      const utxos = mockResponse.data[sender].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));

      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos,
        },
      });

      const result = await GetTransactionDataHandler.getInstance().execute({
        scope: Network.Testnet,
        account: sender,
      });

      expect(result).toStrictEqual({
        data: {
          utxos: utxos.map((utxo) => ({
            ...utxo,
            value: utxo.value.toString(),
          })),
        },
      });
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      createMockChainApiFactory();

      await expect(
        GetTransactionDataHandler.getInstance().execute({
          scope: Network.Testnet,
        }),
      ).rejects.toThrow(InvalidParamsError);
    });
  });
});
