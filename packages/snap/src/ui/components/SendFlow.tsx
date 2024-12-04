import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Container, Text } from '@metamask/snaps-sdk/jsx';

import type { SendFlowParams } from '../../stateManagement';
import { getTranslator } from '../../utils/locale';
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
 * @param props.account - The account information for the transaction.
 * @param props.flushToAddress - Flag to flush to address.
 * @param props.sendFlowParams - Additional parameters for the send flow.
 * @param props.currencySwitched - Flag indicating if the currency was switched.
 * @param props.backEventTriggered - Flag indicating if the back event was triggered.
 * @returns The rendered SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  account,
  sendFlowParams,
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
}) => {
  // eslint-disable-next-line id-length
  const t = getTranslator();
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
        <SendFlowHeader heading={t('send')} />
        <SendForm
          selectedAccount={account.address}
          accounts={[account]}
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
