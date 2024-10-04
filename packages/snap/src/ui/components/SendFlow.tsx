import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Container } from '@metamask/snaps-sdk/jsx';

import type { SendFlowParams } from '../../stateManagement';
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
 * @param props - The properties object.
 * @param props.account - The account information for the transaction.
 * @param props.displayClearIcon - Flag to display the clear icon.
 * @param props.flushToAddress - Flag to flush to address.
 * @param props.sendFlowParams - Additional parameters for the send flow.
 * @param props.currencySwitched - Flag indicating if the currency was switched.
 * @param props.backEventTriggered - Flag indicating if the back event was triggered.
 * @returns The rendered SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  account,
  displayClearIcon,
  sendFlowParams,
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
}) => {
  console.log('SendFlow', sendFlowParams);

  const disabledReview = Boolean(
    !sendFlowParams.amount.valid ||
      !sendFlowParams.recipient.valid ||
      sendFlowParams.fees.loading ||
      sendFlowParams.fees.error,
  );

  const showTransactionSummary =
    Boolean(!sendFlowParams.amount.error && sendFlowParams.amount.amount) ||
    sendFlowParams.fees.loading;
  console.log('amount valid', sendFlowParams.amount.valid);
  console.log('recipient valid', sendFlowParams.recipient.valid);
  console.log('fees loading', sendFlowParams.fees.loading);
  console.log('fees error', sendFlowParams.fees.error);
  return (
    <Container>
      <Box>
        <SendFlowHeader heading="Send" />
        <SendForm
          selectedAccount={account.address}
          accounts={[account]}
          displayClearIcon={displayClearIcon}
          flushToAddress={flushToAddress}
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
          {...sendFlowParams}
        />
        {showTransactionSummary && (
          <TransactionSummary
            fees={sendFlowParams.fees}
            total={sendFlowParams.total}
          />
        )}
      </Box>
      <SendFlowFooter disabled={disabledReview} />
    </Container>
  );
};
