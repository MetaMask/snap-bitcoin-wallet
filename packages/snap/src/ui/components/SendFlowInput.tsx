import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Field,
  Heading,
  Form,
  Input,
  Text,
  Divider,
} from '@metamask/snaps-sdk/jsx';

import type { SendFlowRequest } from '../../stateManagement';
import { Confirmation } from './Confirmations';
import { EstimatedFee } from './EstimatedFee';
import { FromAccount } from './FromAccount';

export type SendFlowProps = Omit<SendFlowRequest, 'id' | 'account'>;

export enum SendFlowNames {
  SenderAddress = 'send-many-sender',
  AddressForm = 'send-many-address-form',
  RecipientInput = 'send-many-recipient-input',
  AmountInput = 'send-many-amount-input',
}

export const SendFlowInput: SnapComponent<SendFlowProps> = ({
  balance,
  transaction,
  estimates,
  validation,
}: SendFlowProps) => {
  console.log('balance', balance);
  console.log('transaction', JSON.stringify(transaction, null, 2));
  console.log('estimates', JSON.stringify(estimates, null, 2));
  console.log('validation', JSON.stringify(validation, null, 2));

  return (
    <Box>
      <Box alignment="center">
        <Heading>Send Bitcoin</Heading>
      </Box>
      <Form name={SendFlowNames.AddressForm}>
        <FromAccount sender={transaction.sender} balance={balance} />
        <Field label="Amount">
          <Input
            name={SendFlowNames.AmountInput}
            placeholder="Enter token amount to send"
            // type="number"
            value={transaction.amount ?? ''}
          />
        </Field>
        {!validation.amount && <Text>Invalid amount</Text>}
        <Field label="To">
          <Input
            name={SendFlowNames.RecipientInput}
            placeholder="Bitcoin address"
            type="text"
            value={transaction.recipient ?? ''}
          />
        </Field>
        {!validation.recipient && <Text>Invalid recipient address</Text>}
      </Form>
      <Divider />
      <EstimatedFee
        isLoading={estimates.fees.loading}
        amount={estimates.fees.fee.amount}
        unit={estimates.fees.fee.unit}
        confirmationTime={estimates.confirmationTime}
      />
      <Confirmation step={'review'} transaction={transaction} />
    </Box>
  );
};
