import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Button, Text, Row } from '@metamask/snaps-sdk/jsx';

import type { SendFlowRequest } from '../../stateManagement';

export enum ConfirmationNames {
  CancelButton = 'send-many-cancel',
  ReviewButton = 'send-many-review',
  SendButton = 'send-many-send',
}

export type ConfirmationProps = {
  // interfaceId: string;
  step: 'review' | 'send';
  transaction: SendFlowRequest['transaction'];
};

export const Confirmation: SnapComponent<ConfirmationProps> = ({
  step,
  transaction,
}) => {
  return (
    <Box direction="vertical">
      <Text>
        This is only temporary until footer components supports multiple pages
      </Text>
      <Box direction="horizontal">
        {step !== 'review' && (
          <Button name={ConfirmationNames.CancelButton}>Back</Button>
        )}
        {step === 'review' && (
          <Button
            name={ConfirmationNames.ReviewButton}
            disabled={
              transaction.amount.length === 0 ||
              transaction.recipient.length === 0
            }
          >
            Proceed to confirm
          </Button>
        )}
      </Box>
    </Box>
  );
};
