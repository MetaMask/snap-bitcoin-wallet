import { InvalidParamsError } from '@metamask/snaps-sdk';

import { generateBlockChairBroadcastTransactionResp } from '../../test/utils';
import { Factory } from '../factory';
import { Network } from '../modules/bitcoin/constants';
import { BroadcastTransactionHandler } from './broadcast-transaction';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BroadcastTransactionHandler', () => {
  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const broadcastTransactionSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        estimateFees: jest.fn(),
        getBalances: jest.fn(),
        broadcastTransaction: broadcastTransactionSpy,
        listTransactions: jest.fn(),
        getTransactionStatus: jest.fn(),
        getDataForTransaction: jest.fn(),
      });
      return {
        broadcastTransactionSpy,
      };
    };

    it('broadcast an transaction', async () => {
      const { broadcastTransactionSpy } = createMockChainApiFactory();
      const resp = generateBlockChairBroadcastTransactionResp();
      broadcastTransactionSpy.mockResolvedValue({
        transactionId: resp.data.transaction_hash,
      });

      const result = await BroadcastTransactionHandler.getInstance().execute({
        scope: Network.Testnet,
        signedTransaction:
          '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000',
      });

      expect(result).toStrictEqual({
        transactionId: resp.data.transaction_hash,
      });
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      createMockChainApiFactory();

      await expect(
        BroadcastTransactionHandler.getInstance().execute({
          scope: 'some invalid value',
        }),
      ).rejects.toThrow(InvalidParamsError);
    });
  });
});
