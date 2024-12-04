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
import { getTranslator } from '../../utils/locale';
import btcIcon from '../images/btc-halo.svg';
import {
  displayEmptyStringIfAmountNotAvailableOrEmptyAmount,
  getNetworkNameFromScope,
} from '../utils';
import { SendFlowHeader } from './SendFlowHeader';
import { SendFormNames } from './SendForm';

export type ReviewTransactionProps = SendFlowRequest & {
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
  account,
  amount,
  total,
  recipient,
  scope,
  txSpeed,
  fees,
}) => {
  // eslint-disable-next-line id-length
  const t = getTranslator();
  const network = getNetworkNameFromScope(scope);
  const disabledSend = Boolean(
    amount.error || recipient.error || total.error || fees.error,
  );

  return (
    <Container>
      <Box>
        <SendFlowHeader heading={t('review')} />
        <Box alignment="center" center>
          <Box direction="horizontal" center>
            <Image src={btcIcon} />
          </Box>
          <Heading size="lg">{`${t('sending')} ${total.amount} BTC`}</Heading>
          <Text color="muted">{t('reviewTransactionWarning')}</Text>
        </Box>
        <Section>
          <Row label={t('from')}>
            <Link href={getExplorerLink(scope, account.address)}>
              <Address
                address={`${account.type}:${account.address}` as CaipAccountId}
              />
            </Link>
          </Row>
          <Row label={t('amount')}>
            <Value
              value={`${amount.amount} BTC`}
              extra={displayEmptyStringIfAmountNotAvailableOrEmptyAmount(
                amount.fiat,
                '$',
              )}
            />
          </Row>
          <Row label={t('recipient')}>
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
          <Row label={t('network')}>
            <Text>{network}</Text>
          </Row>
          <Row
            label={t('transactionSpeed')}
            tooltip={t('transactionSpeedTooltip')}
          >
            <Text>{txSpeed}</Text>
          </Row>
          <Row label={t('networkFee')} tooltip={t('networkFeeToolTip')}>
            <Value
              value={`${fees.amount} BTC`}
              extra={displayEmptyStringIfAmountNotAvailableOrEmptyAmount(
                fees.fiat,
                '$',
              )}
            />
          </Row>
          <Row label={t('total')}>
            <Value
              value={`${total.amount} BTC`}
              extra={displayEmptyStringIfAmountNotAvailableOrEmptyAmount(
                total.fiat,
                '$',
              )}
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
          {t('send')}
        </Button>
      </Footer>
    </Container>
  );
};
