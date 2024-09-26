import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Container } from '@metamask/snaps-sdk/jsx';
import { BigNumber } from 'bignumber.js';

import type { Currency, SendFormErrors } from '../types';
import { SendFlowFooter } from './SendFlowFooter';
import { SendFlowHeader } from './SendFlowHeader';
import { SendForm } from './SendForm';
import { TransactionSummary } from './TransactionSummary';
import { SendFlowParams } from '../../stateManagement';

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
  sendFlowParams: SendFlowParams;
  currencySwitched?: boolean;
  backEventTriggered?: boolean;
};

/**
 * A send flow component, which shows the user a form to send funds to another.
 *
 * @returns The SendFlow component.
 */
/**
 * SendFlow component for handling the send transaction flow in the application.
 *
 * @param {Object} props - The properties object.
 * @param {Account} props.account - The account information for the transaction.
 * @param {boolean} props.displayClearIcon - Flag to display the clear icon.
 * @param {boolean} props.flushToAddress - Flag to flush to address.
 * @param {SendFlowParams} props.sendFlowParams - Additional parameters for the send flow.
 *
 * @returns {JSX.Element} The rendered SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  account,
  displayClearIcon,
  flushToAddress,
  sendFlowParams,
  currencySwitched = false,
  backEventTriggered = false,
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
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
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
