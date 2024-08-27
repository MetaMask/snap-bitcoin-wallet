import type { BtcAccount } from '../bitcoin/wallet';
import { Caip2Asset, Caip2ChainId } from '../constants';
import type { SendManyParams } from '../rpcs';
import { defaultSendManyParams, getBalances } from '../rpcs';
import type { SendFlowRequest, Wallet } from '../stateManagement';
import { generateSendFlowComponent } from './components';
import type { SendFlowProps } from './components/SendFlowInput';

/**
 * Creates a Bitcoin send flow.
 *
 * @param wallet - The wallet object.
 * @param account - The Bitcoin account object.
 * @param sendManyParams - The parameters for sending multiple transactions.
 * @returns The send flow request object.
 */
export async function createBtcSendFlow(
  wallet: Wallet,
  account: BtcAccount,
  sendManyParams: SendManyParams,
) {
  const sendFlowProps: SendFlowProps = {
    balance: '0',
    transaction: {
      sender: wallet.account.address,
      recipient: '',
      amount: '',
      total: '',
      ...defaultSendManyParams(wallet.scope),
      ...sendManyParams,
    },
    estimates: {
      fees: {
        fee: {
          amount: '',
          unit: 'BTC',
        },
        loading: false,
      },
      confirmationTime: '15 minutes',
    },
    validation: {
      amount: true,
      recipient: true,
    },
    errors: {
      fees: '',
      recipient: '',
    },
    step: 'review',
    status: 'creation',
    scope: wallet.scope,
  };

  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: generateSendFlowComponent(sendFlowProps),
    },
  });

  const asset =
    wallet.scope === Caip2ChainId.Mainnet ? Caip2Asset.Btc : Caip2Asset.TBtc;

  const balances = await getBalances(account, {
    assets: [asset],
    scope: wallet.scope,
  });

  const sendFlowRequest: SendFlowRequest = {
    ...sendFlowProps,
    id: interfaceId,
    account: wallet.account.id,
    scope: wallet.scope,
    balance: balances[asset].amount,
  };

  return sendFlowRequest;
}
