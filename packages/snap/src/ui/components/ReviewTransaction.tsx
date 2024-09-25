import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Address,
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Row,
  Section,
  Text,
  Value,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import type { Currency } from '../types';
import type { AccountWithBalance } from '../utils';
import { SendFlowHeader } from './SendFlowHeader';

export type ReviewTransactionProps = {
  account: AccountWithBalance;
  amount: Currency;
  to: string;
  network: string;
  txSpeed: string;
  fees: Currency;
  total: Currency;
};

export const ReviewTransaction: SnapComponent<ReviewTransactionProps> = ({
  account,
  amount,
  total,
  to,
  network,
  txSpeed,
  fees,
}) => (
  <Container>
    <Box>
      <SendFlowHeader heading="Review" />
      <Box alignment="center" center>
        <Heading>{`${total.amount} BTC`}</Heading>
        <Text color="muted">{`$${total.fiat.toString()}`}</Text>
      </Box>
      <Section>
        <Row label="From">
          <Address
            address={`${account.type}:${account.address}` as CaipAccountId}
          />
        </Row>
        <Row label="Amount">
          <Value
            value={`${amount.amount} BTC`}
            extra={`$${amount.fiat.toString()}`}
          />
        </Row>
        <Row label="Recipient">
          <Address address={`${account.type}:${to}`} />
        </Row>
      </Section>
      <Section>
        <Row label="Network">
          <Text>{network}</Text>
        </Row>
        <Row label="Transaction speed" tooltip="TBD">
          <Text>{txSpeed}</Text>
        </Row>
        <Row label="Estimated network fee" tooltip="TBD">
          <Value
            value={`${fees.amount} BTC`}
            extra={`$${fees.fiat.toString()}`}
          />
        </Row>
        <Row label="Total">
          <Value
            value={`${total.amount} BTC`}
            extra={`$${total.fiat.toString()}`}
          />
        </Row>
      </Section>
    </Box>
    <Footer>
      <Button name="send">Send</Button>
    </Footer>
  </Container>
);
