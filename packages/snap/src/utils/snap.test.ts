import { expect } from '@jest/globals';
import type { Component } from '@metamask/snaps-sdk';
import { heading, panel, text, divider, row } from '@metamask/snaps-sdk';

import * as snapUtil from './snap';

jest.mock('@metamask/key-tree', () => ({
  getBIP44AddressKeyDeriver: jest.fn(),
}));

describe('getBip32Deriver', () => {
  it('gets bip32 deriver', async () => {
    const spy = jest.spyOn(snapUtil.getProvider(), 'request');
    const path = ['m', "84'", "0'"];
    const curve = 'secp256k1';

    await snapUtil.getBip32Deriver(path, curve);

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
    const spy = jest.spyOn(snapUtil.getProvider(), 'request');
    const components: Component[] = [
      heading('header'),
      text('subHeader'),
      divider(),
      row('Label1', text('Value1')),
      text('**Label2**:'),
      row('SubLabel1', text('SubValue1')),
    ];

    await snapUtil.confirmDialog(components);

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
    const spy = jest.spyOn(snapUtil.getProvider(), 'request');
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
    const result = await snapUtil.getStateData(true);

    expect(spy).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        operation: 'get',
        encrypted: true,
      },
    });

    expect(result).toStrictEqual(testcase.state);
  });
});

describe('setStateData', () => {
  it('sets state data', async () => {
    const spy = jest.spyOn(snapUtil.getProvider(), 'request');
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

    await snapUtil.setStateData({ data: testcase.state, encrypted: true });

    expect(spy).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: testcase.state,
        encrypted: true,
      },
    });
  });
});
