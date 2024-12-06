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
import { getTranslator } from '../../utils/locale';
import { displayEmptyStringIfAmountNotAvailableOrEmptyAmount } from '../utils';

/**
 * The props for the {@link TransactionSummary} component.
 *
 * @property fees - The fees for the transaction.
 * @property total - The total cost of the transaction.
 */
export type TransactionSummaryProps = {
  fees: SendFlowRequest['fees'];
  total: SendFlowRequest['total'];
};

/**
 * A component that shows the transaction summary.
 *
 * @param props - The component props.
 * @param props.fees - The fees for the transaction.
 * @param props.total - The total cost of the transaction.
 * @returns The TransactionSummary component.
 */
export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  fees,
  total,
}) => {
  const t = getTranslator();

  if (fees.loading) {
    return (
      <Section>
        <Box direction="vertical" alignment="center" center>
          <Spinner />
          <Text>{t('preparingTransaction')}</Text>
        </Box>
      </Section>
    );
  }

  if (fees.error) {
    return (
      <Section>
        <Row label={t('error')}>
          <Text>{fees.error}</Text>
        </Row>
      </Section>
    );
  }

  return (
    <Section>
      <Row label={t('networkFee')} tooltip={t('networkFeeTooltip')}>
        <Value
          value={`${fees.amount.toString()} BTC`}
          extra={displayEmptyStringIfAmountNotAvailableOrEmptyAmount(fees.fiat)}
        />
      </Row>
      <Row label={t('transactionSpeed')} tooltip={t('transactionSpeedTooltip')}>
        <Text>{t('estimatedTransactionSpeed')}</Text>
      </Row>
      <Row label={t('total')}>
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
