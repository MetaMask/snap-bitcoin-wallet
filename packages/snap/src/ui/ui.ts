import { defaultSendManyParams, estimateFee } from '../rpcs';
import type { SendFlowRequest } from '../stateManagement';
import { generateSendFlowComponent } from './components';
import type { SendFlowProps } from './SendFlow';

/**
 * Initiate a new interface with the starting screen.
 *
 * @param scope - The scope of the interface.
 * @param accountId - The ID of the account.
 * @param sender - The Bitcoin account address.
 * @param balance - The balance of the account.
 * @returns The SendFlowRequest object.
 */
export async function createInterface(
  scope: string,
  accountId: string,
  sender: string,
  balance,
): Promise<SendFlowRequest> {
  const fees = await estimateFee({
    account: accountId,
    amount: balance,
  });

  const sendFlowProps: SendFlowProps = {
    balance,
    transaction: {
      sender,
      ...defaultSendManyParams(scope),
    },
    estimates: {
      fees,
      confirmationTime: '15 minutes',
    },
    validation: {
      amount: true,
      recipient: true,
    },
  };

  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: generateSendFlowComponent(sendFlowProps),
    },
  });

  const sendFlowRequest: SendFlowRequest = {
    id: interfaceId,
    account: accountId,
    scope,
    ...sendFlowProps,
  };

  return sendFlowRequest;
}
