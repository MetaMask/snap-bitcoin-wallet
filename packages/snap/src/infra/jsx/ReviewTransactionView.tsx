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

import { ConfigV2 } from '../../configv2';
import type { ReviewTransactionContext } from '../../entities';
import { ReviewTransactionEvent } from '../../entities';
import { networkToCaip2 } from '../../handlers/caip2';
import btcIcon from '../../images/btc-halo.svg';
import { getTranslator } from '../../utils/locale';
import { HeadingWithReturn } from './components';
import { displayAmount, displayFiatAmount } from './format';

export const ReviewTransactionView: SnapComponent<ReviewTransactionContext> = (
  props,
) => {
  const t = getTranslator();
  const { amount, fee, currency, fiatRate, feeRate, recipient, network, from } =
    props;

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
              extra={displayFiatAmount(BigInt(amount), fiatRate)}
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
              {`${ConfigV2.targetBlocksConfirmation * 10} ${t('minutes')}`}
            </Text>
          </Row>
          <Row label={t('transactionFee')} tooltip={t('transactionFeeTooltip')}>
            <Value
              value={displayAmount(BigInt(fee), currency)}
              extra={displayFiatAmount(BigInt(fee), fiatRate)}
            />
          </Row>
          <Row label={t('feeRate')}>
            <Text>{`${feeRate} sat/vb`}</Text>
          </Row>
          <Row label={t('total')}>
            <Value
              value={displayAmount(total, currency)}
              extra={displayFiatAmount(total, fiatRate)}
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
