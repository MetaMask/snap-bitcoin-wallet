import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Container } from '@metamask/snaps-sdk/jsx';
import { BigNumber } from 'bignumber.js';

import type { SendFlowParams } from '../../stateManagement';
import type { Currency, SendFormErrors } from '../types';
import { SendFlowFooter } from './SendFlowFooter';
import { SendFlowHeader } from './SendFlowHeader';
import { SendForm } from './SendForm';
import { TransactionSummary } from './TransactionSummary';

/**
 * The props for the {@link SendFlow} component.
 *
 * @property accounts - The available accounts.
 * @property selectedAccount - The currently selected account.
 * @property selectedCurrency - The selected currency to display.
 * @property amount - The amount to send of the transaction.
 * @property fees - The fees for the transaction.
 * @property displayClearIcon - Whether to display the clear icon or not.
 * @property flushToAddress - Whether to flush the address field or not.
 * @property errors - The form errors.
 */
export type SendFlowProps = {
  account: KeyringAccount;
  displayClearIcon: boolean;
  flushToAddress?: boolean;
  switchValue?: boolean;
  sendFlowParams: SendFlowParams;
};

/**
 * A send flow component, which shows the user a form to send funds to another.
 *
 * @returns The SendFlow component.
 */
/**
 * SendFlow component for handling the send transaction flow in the application.
 *
 * @param props - The properties object.
 * @param props.account - The account information for the transaction.
 * @param props.displayClearIcon - Flag to display the clear icon.
 * @param props.flushToAddress - Flag to flush to address.
 * @param props.switchValue - Flag to switch the amount value.
 * @param props.sendFlowParams - Additional parameters for the send flow.
 * @returns The rendered SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  account,
  displayClearIcon,
  flushToAddress,
  sendFlowParams,
}) => {
  const disabledReview =
    !sendFlowParams.amount.valid ||
    !sendFlowParams.recipient.valid ||
    sendFlowParams.fees.loading;
  return (
    <Container>
      <Box>
        <SendFlowHeader heading="Send" />
        <SendForm
          selectedAccount={account.address}
          accounts={[account]}
          flushToAddress={flushToAddress}
          displayClearIcon={displayClearIcon}
          {...sendFlowParams}
        />
        {new BigNumber(sendFlowParams.amount.amount).gt(new BigNumber(0)) ? (
          <TransactionSummary
            fees={sendFlowParams.fees}
            total={sendFlowParams.total}
          />
        ) : null}
      </Box>
      <SendFlowFooter disabled={disabledReview} />
    </Container>
  );
};
