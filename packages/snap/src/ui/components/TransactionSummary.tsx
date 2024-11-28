import {
  Box,
  Row,
  Section,
  Spinner,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import type { SendFlowRequest } from '../../stateManagement';
import type { Locale } from '../../utils/locale';
import { displayEmptyStringIfAmountNotAvailableOrEmptyAmount } from '../utils';

/**
 * The props for the {@link TransactionSummary} component.
 *
 * @property fees - The fees for the transaction.
 * @property total - The total cost of the transaction.
 */
export type TransactionSummaryProps = {
  locale: Locale;
  fees: SendFlowRequest['fees'];
  total: SendFlowRequest['total'];
};

/**
 * A component that shows the transaction summary.
 *
 * @param props - The component props.
 * @param props.locale - The locale of the user.
 * @param props.fees - The fees for the transaction.
 * @param props.total - The total cost of the transaction.
 * @returns The TransactionSummary component.
 */
export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  locale,
  fees,
  total,
}) => {
  if (fees.loading) {
    return (
      <Section>
        <Box direction="vertical" alignment="center" center>
          <Spinner />
          <Text>{locale.preparingTransaction.message}</Text>
        </Box>
      </Section>
    );
  }

  if (fees.error) {
    return (
      <Section>
        <Row label={locale.error.message}>
          <Text>{fees.error}</Text>
        </Row>
      </Section>
    );
  }

  return (
    <Section>
      <Row
        label={locale.networkFee.message}
        tooltip={locale.networkFeeTooltip.message}
      >
        <Value
          value={`${fees.amount.toString()} BTC`}
          extra={displayEmptyStringIfAmountNotAvailableOrEmptyAmount(fees.fiat)}
        />
      </Row>
      <Row
        label={locale.transactionSpeed.message}
        tooltip={locale.transactionSpeedTooltip.message}
      >
        <Text>{locale.estimatedTransactionSpeed.message}</Text>
      </Row>
      <Row label={locale.total.message}>
        <Value
          value={`${total.amount.toString()} BTC`}
          extra={displayEmptyStringIfAmountNotAvailableOrEmptyAmount(
            total.fiat,
          )}
        />
      </Row>
    </Section>
  );
};
