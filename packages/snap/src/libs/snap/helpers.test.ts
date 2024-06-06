import { expect } from '@jest/globals';
import type { Component } from '@metamask/snaps-sdk';
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
      const components: Component[] = [
        heading('header'),
        text('subHeader'),
        divider(),
        row('Label1', text('Value1')),
        text('**Label2**:'),
        row('SubLabel1', text('SubValue1')),
      ];

      await SnapHelper.confirmDialog(components);

      expect(spy).toHaveBeenCalledWith({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel(components),
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
              txHash: 'hash',
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
              txHash: 'hash',
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
