import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Heading, Form, Text, Row } from '@metamask/snaps-sdk/jsx';

import { Caip2ChainId } from '../../constants';
import type { SendFlowRequest } from '../../stateManagement';
import { Confirmation } from './Confirmations';
import { EstimatedFee } from './EstimatedFee';
import { FromAccount } from './FromAccount';
import { Receipient } from './Receipient';

export enum SendFlowNames {
  SenderAddress = 'send-many-sender',
  AddressForm = 'send-many-address-form',
  RecipientInput = 'send-many-recipient-input',
  AmountInput = 'send-many-amount-input',
  SubmitButton = 'submit',
}

export type SendFlowConfirmationProps = {
  balance: SendFlowRequest['balance'];
  transaction: SendFlowRequest['transaction'];
  estimates: SendFlowRequest['estimates'];
  scope: SendFlowRequest['scope'];
};

export const SendFlowConfirmation: SnapComponent<SendFlowConfirmationProps> = ({
  balance,
  transaction,
  estimates,
  scope,
}: SendFlowConfirmationProps) => {
  return (
    <Box>
      <Box alignment="center">
        <Heading>Send Bitcoin</Heading>
      </Box>
      <Form name={SendFlowNames.AddressForm}>
        <FromAccount sender={transaction.sender} balance={balance} />
        <Receipient
          recipient={transaction.recipient}
          network={
            scope === Caip2ChainId.Mainnet
              ? 'Bitcoin Mainnet'
              : 'Bitcoin Testnet'
          }
          amount={transaction.amount}
        />
        <EstimatedFee
          isLoading={estimates.fees.loading}
          amount={estimates.fees.fee.amount}
          unit={estimates.fees.fee.unit}
          confirmationTime={estimates.confirmationTime}
        />
      </Form>
      <Row label="Total">
        <Text>{`${transaction.total} BTC`}</Text>
      </Row>
      <Confirmation step="send" transaction={transaction} />
    </Box>
  );
};
