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
  Link,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import { BaseExplorerUrl, Caip2ChainId } from '../../constants';
import type { SendFlowRequest } from '../../stateManagement';
import type { Locale } from '../../utils/locale';
import btcIcon from '../images/btc-halo.svg';
import { getNetworkNameFromScope } from '../utils';
import { SendFlowHeader } from './SendFlowHeader';
import { SendFormNames } from './SendForm';

export type ReviewTransactionProps = SendFlowRequest & {
  locale: Locale;
  txSpeed: string;
};

const getExplorerLink = (scope: string, address: string) => {
  const explorerBaseLink =
    scope === Caip2ChainId.Mainnet
      ? BaseExplorerUrl.Mainnet
      : BaseExplorerUrl.Testnet;

  return `${explorerBaseLink}/${address}`;
};

export const ReviewTransaction: SnapComponent<ReviewTransactionProps> = ({
  locale,
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
        <SendFlowHeader heading={locale.review.message} />
        <Box alignment="center" center>
          <Box direction="horizontal" center>
            <Image src={btcIcon} />
          </Box>
          <Heading size="lg">{`${locale.sending.message} ${total.amount} BTC`}</Heading>
          <Text color="muted">Review the transaction before proceeding</Text>
        </Box>
        <Section>
          <Row label={locale.from.message}>
            <Link href={getExplorerLink(scope, account.address)}>
              <Address
                address={`${account.type}:${account.address}` as CaipAccountId}
              />
            </Link>
          </Row>
          <Row label={locale.amount.message}>
            <Value value={`${amount.amount} BTC`} extra={`$${amount.fiat}`} />
          </Row>
          <Row label={locale.recipient.message}>
            <Link href={getExplorerLink(scope, recipient.address)}>
              <Address
                address={
                  `${account.type}:${recipient.address}` as CaipAccountId
                }
              />
            </Link>
          </Row>
        </Section>
        <Section>
          <Row label={locale.network.message}>
            <Text>{network}</Text>
          </Row>
          <Row
            label={locale.transactionSpeed.message}
            tooltip={locale.transactionSpeedTooltip.message}
          >
            <Text>{txSpeed}</Text>
          </Row>
          <Row
            label={locale.networkFee.message}
            tooltip={locale.networkFeeTooltip.message}
          >
            <Value value={`${fees.amount} BTC`} extra={`$${fees.fiat}`} />
          </Row>
          <Row label={locale.total.message}>
            <Value value={`${total.amount} BTC`} extra={`$${total.fiat}`} />
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
          {locale.send.message}
        </Button>
      </Footer>
    </Container>
  );
};
