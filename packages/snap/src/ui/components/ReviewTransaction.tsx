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
  Image,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import type { SendFlowRequest } from '../../stateManagement';
import btcIcon from '../images/btc.svg';
import { getNetworkNameFromScope } from '../utils';
import { SendFlowHeader } from './SendFlowHeader';
import { SendFormNames } from './SendForm';

export type ReviewTransactionProps = SendFlowRequest & {
  txSpeed: string;
};

export const ReviewTransaction: SnapComponent<ReviewTransactionProps> = ({
  account,
  amount,
  total,
  recipient,
  scope,
  txSpeed,
  fees,
}) => {
  const network = getNetworkNameFromScope(scope);
  const disabledSend = Boolean(
    amount.error || recipient.error || total.error || fees.error,
  );

  return (
    <Container>
      <Box>
        <SendFlowHeader heading="Review" />
        <Box alignment="center" center>
          <Box>
            <Image src={btcIcon} />
          </Box>
          <Heading>{`Sending ${total.amount} BTC`}</Heading>
          <Text color="muted">Review the transaction before proceeding</Text>
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
              extra={`$${amount.fiat}`}
            />
          </Row>
          <Row label="Recipient">
            <Address address={`${account.type}:${recipient.address}`} />
          </Row>
        </Section>
        <Section>
          <Row label="Network">
            <Text>{network}</Text>
          </Row>
          <Row label="Transaction speed" tooltip="The estimated time of the transaction">
            <Text>{txSpeed}</Text>
          </Row>
          <Row label="Network fee" tooltip="The estimated network fee">
            <Value
              value={`${fees.amount} BTC`}
              extra={`$${fees.fiat}`}
            />
          </Row>
          <Row label="Total">
            <Value
              value={`${total.amount} BTC`}
              extra={`$${total.fiat}`}
            />
          </Row>
        </Section>
        {Boolean(recipient.error) && (
          <Text color="error">{recipient.error}</Text>
        )}
        {Boolean(amount.error) && <Text color="error">{amount.error}</Text>}
        {Boolean(fees.error) && <Text color="error">{fees.error}</Text>}
        {Boolean(total.error) && <Text color="error">{total.error}</Text>}
      </Box>
      <Footer>
        <Button name={SendFormNames.Send} type="submit" disabled={disabledSend}>
          Send
        </Button>
      </Footer>
    </Container>
  );
};
