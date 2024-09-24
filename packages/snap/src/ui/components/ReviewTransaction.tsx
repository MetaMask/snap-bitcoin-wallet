import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Address,
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Image,
  Link,
  Row,
  Section,
  Text,
  Value,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import btcHaloIcon from '../images/btc-halo.svg';
import btcIcon from '../images/btc.svg';
import jazzIcon from '../images/jazzicon1.svg';
import type { Currency } from '../types';
import { SendFlowHeader } from './SendFlowHeader';

export type ReviewTransactionProps = {
  accountName: string;
  amount: Currency;
  to: CaipAccountId;
  network: string;
  txSpeed: string;
  fees: Currency;
  total: Currency;
};

export const ReviewTransaction: SnapComponent<ReviewTransactionProps> = ({
  accountName,
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
      <Box>
        <Image src={btcHaloIcon} alt="Bitcoin icon" />
        <Heading>{`${total.amount} BTC`}</Heading>
        <Text color="muted">{`$${total.fiat}`}</Text>
      </Box>
      <Section>
        <Row label="From">
          <Box direction="horizontal" alignment="center">
            <Image src={jazzIcon} alt="Jazzicon" />
            <Link href="https://example.com">{accountName}</Link>
          </Box>
        </Row>
        <Row label="Amount">
          <Value value={`${amount.amount} BTC`} extra={`$${amount.fiat}`} />
        </Row>
        <Row label="Recipient">
          <Address address={to} />
        </Row>
      </Section>
      <Section>
        <Row label="Network">
          <Box direction="horizontal" alignment="center">
            <Image src={btcIcon} alt="Bitcoin icon" />
            <Text>{network}</Text>
          </Box>
        </Row>
        <Row label="Transaction speed" tooltip="TBD">
          <Text>{txSpeed}</Text>
        </Row>
        <Row label="Estimated network fee" tooltip="TBD">
          <Value value={`${fees.amount} BTC`} extra={`$${fees.fiat}`} />
        </Row>
        <Row label="Total">
          <Value value={`${total.amount} BTC`} extra={`$${total.fiat}`} />
        </Row>
      </Section>
    </Box>
    <Footer>
      <Button name="send">Send</Button>
    </Footer>
  </Container>
);
