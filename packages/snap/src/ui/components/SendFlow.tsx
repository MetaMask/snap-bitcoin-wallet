import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Container } from '@metamask/snaps-sdk/jsx';

import type { SendFlowParams } from '../../stateManagement';
import type { Locale } from '../../utils/locale';
import { SendFlowFooter } from './SendFlowFooter';
import { SendFlowHeader } from './SendFlowHeader';
import { SendForm } from './SendForm';
import { TransactionSummary } from './TransactionSummary';

/**
 * The props for the {@link SendFlow} component.
 *
 * @property account - The account information for the transaction.
 * @property flushToAddress - Flag to flush to address.
 * @property sendFlowParams - Additional parameters for the send flow.
 * @property currencySwitched - Flag indicating if the currency was switched.
 * @property backEventTriggered - Flag indicating if the back event was triggered.
 */
export type SendFlowProps = {
  locale: Locale;
  account: KeyringAccount;
  flushToAddress?: boolean;
  sendFlowParams: SendFlowParams;
  currencySwitched?: boolean;
  backEventTriggered?: boolean;
};

/**
 * A send flow component, which shows the user a form to send funds to another.
 *
 * @param props - The properties object.
 * @param props.locale - The locale of the user.
 * @param props.account - The account information for the transaction.
 * @param props.flushToAddress - Flag to flush to address.
 * @param props.sendFlowParams - Additional parameters for the send flow.
 * @param props.currencySwitched - Flag indicating if the currency was switched.
 * @param props.backEventTriggered - Flag indicating if the back event was triggered.
 * @returns The rendered SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  locale,
  account,
  sendFlowParams,
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
}) => {
  const { amount, recipient, fees, total } = sendFlowParams;

  const disabledReview = Boolean(
    !amount.valid ||
      !recipient.valid ||
      !total.valid ||
      fees.loading ||
      fees.error,
  );

  const showTransactionSummary =
    Boolean(!amount.error && amount.amount) || fees.loading;

  return (
    <Container>
      <Box>
        <SendFlowHeader heading={locale.send.message} />
        <SendForm
          locale={locale}
          selectedAccount={account.address}
          accounts={[account]}
          flushToAddress={flushToAddress}
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
          {...sendFlowParams}
        />
        {showTransactionSummary && (
          <TransactionSummary
            locale={locale}
            fees={sendFlowParams.fees}
            total={sendFlowParams.total}
          />
        )}
      </Box>
      <SendFlowFooter locale={locale} disabled={disabledReview} />
    </Container>
  );
};
