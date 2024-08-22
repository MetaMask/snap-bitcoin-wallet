import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Row,
  Box,
  Field,
  Heading,
  Form,
  Input,
  Text,
} from '@metamask/snaps-sdk/jsx';

import type { SendFlowRequest } from '../stateManagement';

export type SendFlowProps = Omit<SendFlowRequest, 'id' | 'scope' | 'account'>;

export enum SendFlowNames {
  SenderAddress = 'send-many-sender',
  AddressForm = 'send-many-address-form',
  RecipientInput = 'send-many-recipient-input',
  AmountInput = 'send-many-amount-input',
  SubmitButton = 'submit',
}

/**
 * Shortens a string.
 * @param str - The string to be shortened.
 * @returns The shortened string.
 */
function shortenString(str: string): string {
  if (str.length <= 10) {
    return str;
  }
  const firstPart = str.slice(0, 5);
  const lastPart = str.slice(-5);
  return `${firstPart}...${lastPart}`;
}

export const SendFlow: SnapComponent<SendFlowProps> = ({
  balance,
  transaction,
  estimates,
  validation,
}: SendFlowProps) => {
  return (
    <Box>
      <Box alignment="center">
        <Heading>Send Bitcoin</Heading>
      </Box>
      <Form name={SendFlowNames.AddressForm}>
        <Box direction="horizontal" alignment="space-between">
          <Box>
            <Text>icon</Text>
          </Box>
          <Box direction="vertical">
            <Text>Bitcoin Account</Text>
            <Text>{shortenString(transaction.sender)}</Text>
          </Box>
          <Box direction="vertical">
            <Text>BTC</Text>
            <Text>{balance}</Text>
          </Box>
        </Box>
        <Field label="Amount">
          <Input
            name={SendFlowNames.AmountInput}
            placeholder="Amount"
            type="number"
            value={transaction?.amount}
          />
        </Field>
        {!validation.amount && <Text>Invalid amount</Text>}
        <Field label="To">
          <Input
            name={SendFlowNames.RecipientInput}
            placeholder="Bitcoin address"
            type="text"
            value={transaction?.recipient}
          />
        </Field>
        {!validation.recipient && <Text>Invalid recipient address</Text>}
        <Row label="Estimated fee">
          <Text>{`${estimates.fees.fee.amount} ${estimates.fees.fee.unit}`}</Text>
        </Row>
        <Row label="Estimated fee">
          <Text>{`${estimates.confirmationTime}`}</Text>
        </Row>
      </Form>
    </Box>
  );
};
