import type { KeyringAccount } from '@metamask/keyring-api';

import type { SendFlowRequest } from '../stateManagement';
import { TransactionStatus, type SendFlowParams } from '../stateManagement';
import { AssetType } from '../ui/types';
import { generateSendBitcoinParams } from '../ui/utils';

export const generateDefaultSendFlowParams = (
  scope: string,
): SendFlowParams => {
  return {
    selectedCurrency: AssetType.BTC,
    recipient: {
      address: '',
      error: '',
      valid: false,
    },
    fees: {
      amount: '',
      fiat: '',
      loading: false,
      error: '',
    },
    amount: {
      amount: '',
      fiat: '',
      error: '',
      valid: false,
    },
    rates: '',
    balance: {
      amount: '',
      fiat: '',
    },
    total: {
      amount: '',
      fiat: '',
      error: '',
      valid: false,
    },
    scope,
  };
};

export const generateDefaultSendFlowRequest = (
  account: KeyringAccount,
  scope: string,
  requestId: string,
  interfaceId: string,
): SendFlowRequest => {
  return {
    id: requestId,
    interfaceId,
    account,
    transaction: generateSendBitcoinParams(scope),
    status: TransactionStatus.Draft,
    // Send flow params
    ...generateDefaultSendFlowParams(scope),
  };
};
