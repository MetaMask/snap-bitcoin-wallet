import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Row, Text } from '@metamask/snaps-sdk/jsx';

import type { SendFlowRequest } from '../../stateManagement';

export type RecipientProps = {
  recipient: SendFlowRequest['transaction']['recipient'];
  network: SendFlowRequest['scope'];
  amount: SendFlowRequest['transaction']['amount'];
};

export const Receipient: SnapComponent<RecipientProps> = ({
  recipient,
  network,
  amount,
}: RecipientProps) => {
  return (
    <Box>
      <Row label="Recipient">
        <Text>{recipient}</Text>
      </Row>
      <Row label="Network">
        <Text>{network}</Text>
      </Row>
      <Row label="Amount">
        <Text>{amount}</Text>
      </Row>
    </Box>
  );
};
