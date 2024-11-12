import { InvalidParamsError } from '@metamask/snaps-sdk';

import type { BtcAccount } from '../bitcoin/wallet';
import { Caip2ChainId } from '../constants';
import { satsToBtc } from '../utils';
import { SendBitcoinTest } from './__tests__/helper';
import { type SendBitcoinParams, sendBitcoin } from './send-bitcoin';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('SendBitcoinHandler', () => {
  describe('sendBitcoin', () => {
    const origin = 'http://localhost:3000';

    const createSendBitcoinParams = (
      recipients: BtcAccount[],
      caip2ChainId: string,
      dryrun: boolean,
      amount = 500,
    ): SendBitcoinParams => {
      return {
        recipients: recipients.reduce((acc, recipient) => {
          acc[recipient.address] = satsToBtc(amount);
          return acc;
        }, {}),
        replaceable: true,
        dryrun,
        scope: caip2ChainId,
      } as unknown as SendBitcoinParams;
    };

    const prepareSendBitcoin = async (
      caip2ChainId: string,
      recipientCount = 10,
      feeRate = 1,
      utxoCount = 10,
      utxoMinVal = 100000,
      utxoMaxVal = 100000,
    ) => {
      const testHelper = new SendBitcoinTest({
        caip2ChainId,
        utxoCount,
        utxoMinVal,
        utxoMaxVal,
        feeRate,
        recipientCount,
      });
      await testHelper.setup();

      return testHelper;
    };

    it('returns correct result', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        sender,
        recipients,
        broadCastTxResp,
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      } = await prepareSendBitcoin(caip2ChainId);

      const result = await sendBitcoin(
        sender,
        origin,
        createSendBitcoinParams(recipients, caip2ChainId, false),
      );

      expect(result).toStrictEqual({ txId: broadCastTxResp });
      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast transaction if in dryrun mode', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, sender, broadcastTransactionSpy } =
        await prepareSendBitcoin(caip2ChainId);

      await sendBitcoin(
        sender,
        origin,
        createSendBitcoinParams(recipients, caip2ChainId, true),
      );

      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('throws InvalidParamsError when request parameter is not correct', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender } = await prepareSendBitcoin(caip2ChainId);

      await expect(
        sendBitcoin(sender, origin, {
          recipients: {
            'some-address': '1',
          },
        } as unknown as SendBitcoinParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `Recipients object must have at least one recipient` error if no recipient provided', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await prepareSendBitcoin(caip2ChainId, 0);

      await expect(
        sendBitcoin(
          sender,
          origin,
          createSendBitcoinParams(recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Recipients object must have at least one recipient');
    });

    it('throws `Invalid amount, must be a positive finite number` error if receive amount is not valid', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await prepareSendBitcoin(caip2ChainId, 2);

      await expect(
        sendBitcoin(sender, origin, {
          ...createSendBitcoinParams(recipients, caip2ChainId, false),
          recipients: {
            [recipients[0].address]: 'invalid',
            [recipients[1].address]: '0.1',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');

      await expect(
        sendBitcoin(sender, origin, {
          ...createSendBitcoinParams(recipients, caip2ChainId, false),
          recipients: {
            [recipients[0].address]: '0',
            [recipients[1].address]: '0.1',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');

      await expect(
        sendBitcoin(sender, origin, {
          ...createSendBitcoinParams(recipients, caip2ChainId, false),
          recipients: {
            [recipients[0].address]: 'invalid',
            [recipients[1].address]: '0.000000019',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');
    });

    it('throws `Invalid amount, out of bounds` error if receive amount is out of bounds', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await prepareSendBitcoin(caip2ChainId, 2);

      await expect(
        sendBitcoin(sender, origin, {
          ...createSendBitcoinParams(recipients, caip2ChainId, false),
          recipients: {
            [recipients[0].address]: '1',
            [recipients[1].address]: '999999999.99999999',
          },
        }),
      ).rejects.toThrow('Invalid amount, out of bounds');
    });

    it('throws `Invalid response` error if the response is unexpected', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, broadcastTransactionSpy } =
        await prepareSendBitcoin(caip2ChainId);

      broadcastTransactionSpy.mockResolvedValue({
        transactionId: '',
      });
      await expect(
        sendBitcoin(sender, origin, {
          ...createSendBitcoinParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Invalid Response');
    });

    it('throws `Failed to send the transaction` error if no fee rate is returned from the chain service', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, getFeeRatesSpy } = await prepareSendBitcoin(
        caip2ChainId,
      );
      getFeeRatesSpy.mockResolvedValue({
        fees: [],
      });

      await expect(
        sendBitcoin(
          sender,
          origin,
          createSendBitcoinParams(recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws `Failed to send the transaction` error if the transaction is fail to commit', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { broadcastTransactionSpy, sender, recipients } =
        await prepareSendBitcoin(caip2ChainId);
      broadcastTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        sendBitcoin(sender, origin, {
          ...createSendBitcoinParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Failed to send the transaction');
    });
  });
});
