import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Button } from '@metamask/snaps-sdk/jsx';

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
    <Box direction="horizontal">
      <Button name={ConfirmationNames.CancelButton}>
        {step === 'review' ? 'Cancel' : 'Back'}
      </Button>
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
  );
};
