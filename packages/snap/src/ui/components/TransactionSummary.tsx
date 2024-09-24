import {
  Box,
  Row,
  Section,
  Spinner,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import type { Currency, SendFormErrors } from '../types';

/**
 * The props for the {@link TransactionSummary} component.
 *
 * @property fees - The fees for the transaction.
 * @property total - The total cost of the transaction.
 */
export type TransactionSummaryProps = {
  isLoading: boolean;
  fees: Currency;
  total: Currency;
  errors?: SendFormErrors;
};

/**
 * A component that shows the transaction summary.
 *
 * @param props - The component props.
 * @param props.fees - The fees for the transaction.
 * @param props.total - The total cost of the transaction.
 * @param props.isLoading - Whether the transaction is loading or not.
 * @param props.errors - The form errors.
 * @returns The TransactionSummary component.
 */
export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  isLoading,
  fees,
  total,
  errors,
}) => {
  if (isLoading) {
    return (
      <Section>
        <Box direction="vertical" alignment="center" center>
          <Spinner />
          <Text>Preparing transaction</Text>
        </Box>
      </Section>
    );
  }

  if (errors?.fees) {
    return (
      <Section>
        <Row label="Error">
          <Text>{errors.fees}</Text>
        </Row>
      </Section>
    );
  }

  return (
    <Section>
      <Row label="Estimated network fee">
        <Value
          value={`${fees.amount.toString()} BTC`}
          extra={`$${fees.fiat.toString()}`}
        />
      </Row>
      <Row label="Transaction speed" tooltip="The estimated time of the TX">
        <Text>30m</Text>
      </Row>
      <Row label="Total">
        <Value
          value={`${total.amount.toString()} BTC`}
          extra={`$${total.fiat.toString()}`}
        />
      </Row>
    </Section>
  );
};
