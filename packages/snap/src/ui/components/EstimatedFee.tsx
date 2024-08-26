import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Row, Text, Divider, Spinner, Box } from '@metamask/snaps-sdk/jsx';

export type EstimatedFeeProps = {
  isLoading: boolean;
  amount: string;
  unit: string;
  confirmationTime: string;
};

export const EstimatedFee: SnapComponent<EstimatedFeeProps> = ({
  isLoading,
  amount,
  unit,
  confirmationTime,
}: EstimatedFeeProps) => {
  return (
    <Box>
      {isLoading && <Spinner />}
      {!isLoading && amount.length > 0 && (
        <Box>
          <Divider />
          <Row label="Estimated fee">
            <Text>{`${amount} ${unit}`}</Text>
          </Row>
          <Row label="Transaction speed">
            <Text>{`${confirmationTime}`}</Text>
          </Row>
        </Box>
      )}
    </Box>
  );
};
