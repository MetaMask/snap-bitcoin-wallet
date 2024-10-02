import {
  Box,
  Row,
  Section,
  Spinner,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { SendFlowRequest } from '../../stateManagement';

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
  if (fees.loading) {
    return (
      <Section>
        <Box direction="vertical" alignment="center" center>
          <Spinner />
          <Text>Preparing transaction</Text>
        </Box>
      </Section>
    );
  }

  if (fees.error) {
    return (
      <Section>
        <Row label="Error">
          <Text>{fees.error}</Text>
        </Row>
      </Section>
    );
  }

  return (
    <Section>
      <Row label="Network fee" tooltip="The estimated network fee">
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
