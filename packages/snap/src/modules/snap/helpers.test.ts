import { expect } from '@jest/globals';
import { heading, panel, text, divider, row } from '@metamask/snaps-sdk';

import { SnapHelper } from './helpers';

jest.mock('@metamask/key-tree', () => ({
  getBIP44AddressKeyDeriver: jest.fn(),
}));

describe('SnapHelper', () => {
  describe('getBip44Deriver', () => {
    it('gets bip44 deriver', async () => {
      const spy = jest.spyOn(SnapHelper.provider, 'request');
      const coinType = 1001;

      await SnapHelper.getBip44Deriver(coinType);

      expect(spy).toHaveBeenCalledWith({
        method: 'snap_getBip44Entropy',
        params: {
          coinType,
        },
      });
    });
  });

  describe('getBip32Deriver', () => {
    it('gets bip32 deriver', async () => {
      const spy = jest.spyOn(SnapHelper.provider, 'request');
      const path = ['m', "84'", "0'"];
      const curve = 'secp256k1';

      await SnapHelper.getBip32Deriver(path, curve);

      expect(spy).toHaveBeenCalledWith({
        method: 'snap_getBip32Entropy',
        params: {
          path,
          curve,
        },
      });
    });
  });

  describe('confirmDialog', () => {
    it('calls snap_dialog', async () => {
      const spy = jest.spyOn(SnapHelper.provider, 'request');
      const testcase = {
        header: 'header',
        subHeader: 'subHeader',
        body: [
          {
            label: 'Label1',
            value: 'Value1',
          },
          {
            label: 'Label2',
            value: [
              {
                label: 'SubLabel1',
                value: 'SubValue1',
              },
            ],
          },
        ],
      };

      await SnapHelper.confirmDialog(
        testcase.header,
        testcase.subHeader,
        testcase.body,
      );

      expect(spy).toHaveBeenCalledWith({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading(testcase.header),
            text(testcase.subHeader),
            divider(),
            row(
              testcase.body[0].label,
              text(testcase.body[0].value as unknown as string),
            ),
            text(`**${testcase.body[1].label}**:`),
            row(
              (
                testcase.body[1].value[0] as unknown as {
                  label: string;
                  value: string;
                }
              ).label,
              text(
                (
                  testcase.body[1].value[0] as unknown as {
                    label: string;
                    value: string;
                  }
                ).value,
              ),
            ),
          ]),
        },
      });
    });
  });

  describe('getStateData', () => {
    it('gets state data', async () => {
      const spy = jest.spyOn(SnapHelper.provider, 'request');
      const testcase = {
        state: {
          transaction: [
            {
              txnHash: 'hash',
              chainId: 'chainId',
            },
          ],
        },
      };

      spy.mockResolvedValue(testcase.state);
      const result = await SnapHelper.getStateData();

      expect(spy).toHaveBeenCalledWith({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });

      expect(result).toStrictEqual(testcase.state);
    });
  });

  describe('setStateData', () => {
    it('sets state data', async () => {
      const spy = jest.spyOn(SnapHelper.provider, 'request');
      const testcase = {
        state: {
          transaction: [
            {
              txnHash: 'hash',
              chainId: 'chainId',
            },
          ],
        },
      };

      await SnapHelper.setStateData(testcase.state);

      expect(spy).toHaveBeenCalledWith({
        method: 'snap_manageState',
        params: {
          operation: 'update',
          newState: testcase.state,
        },
      });
    });
  });
});
