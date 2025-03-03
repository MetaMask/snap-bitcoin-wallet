import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
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
  Address,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import { Config } from '../../config';
import type { ReviewTransactionContext } from '../../entities';
import { BlockTime, ReviewTransactionEvent } from '../../entities';
import { getTranslator } from '../../entities/locale';
import { networkToCaip2 } from '../../handlers/caip';
import { HeadingWithReturn } from './components';
import { displayAmount, displayExchangeAmount } from './format';
import btcIcon from './images/btc-halo.svg';

export const ReviewTransactionView: SnapComponent<ReviewTransactionContext> = (
  props,
) => {
  const t = getTranslator();
  const {
    amount,
    fee,
    currency,
    exchangeRate,
    feeRate,
    recipient,
    network,
    from,
  } = props;

  const total = BigInt(amount) + BigInt(fee);

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          returnButtonName={ReviewTransactionEvent.HeaderBack}
          heading={t('review')}
        />

        <Box alignment="center" center>
          <Box direction="horizontal" center>
            <Image src={btcIcon} />
          </Box>
          <Heading size="lg">{`${t('sending')} ${displayAmount(
            BigInt(amount),
            currency,
          )}`}</Heading>
          <Text color="muted">{t('reviewTransactionWarning')}</Text>
        </Box>

        <Section>
          <Row label={t('from')}>
            <Address
              address={`${networkToCaip2[network]}:${from}` as CaipAccountId}
              displayName
            />
          </Row>
          <Row label={t('amount')}>
            <Value
              value={displayAmount(BigInt(amount), currency)}
              extra={displayExchangeAmount(BigInt(amount), exchangeRate)}
            />
          </Row>
          <Row label={t('recipient')}>
            <Address
              address={
                `${networkToCaip2[network]}:${recipient}` as CaipAccountId
              }
              avatar={false}
            />
          </Row>
        </Section>

        <Section>
          <Row
            label={t('transactionSpeed')}
            tooltip={t('transactionSpeedTooltip')}
          >
            <Text>
              {`${Config.targetBlocksConfirmation * BlockTime[network]} ${t(
                'minutes',
              )}`}
            </Text>
          </Row>
          <Row label={t('transactionFee')} tooltip={t('transactionFeeTooltip')}>
            <Value
              value={`${fee} sats`}
              extra={displayExchangeAmount(BigInt(fee), exchangeRate)}
            />
          </Row>
          <Row label={t('feeRate')}>
            <Text>{`${Math.floor(feeRate)} sat/vb`}</Text>
          </Row>
          <Row label={t('total')}>
            <Value
              value={displayAmount(total, currency)}
              extra={displayExchangeAmount(total, exchangeRate)}
            />
          </Row>
        </Section>
      </Box>

      <Footer>
        <Button name={ReviewTransactionEvent.Send} type="submit">
          {t('send')}
        </Button>
      </Footer>
    </Container>
  );
};
