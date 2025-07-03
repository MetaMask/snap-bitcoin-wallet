import { Psbt } from '@metamask/bitcoindevkit';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Row,
  Section,
  Text as SnapText,
  Value,
  Address,
  Link,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import { AssetIcon, HeadingWithReturn } from './components';
import {
  displayAmount,
  displayExchangeAmount,
  displayExplorerUrl,
  translate,
} from './format';
import { Config } from '../../config';
import type { Messages, ReviewTransactionContext } from '../../entities';
import {
  BlockTime,
  networkToCurrencyUnit,
  ReviewTransactionEvent,
} from '../../entities';
import { networkToScope } from '../../handlers';

type ReviewTransactionViewProps = {
  context: ReviewTransactionContext;
  messages: Messages;
};

export const ReviewTransactionView: SnapComponent<
  ReviewTransactionViewProps
> = ({ context, messages }) => {
  const t = translate(messages);
  const { amount, exchangeRate, recipient, network, from, explorerUrl } =
    context;

  const psbt = Psbt.from_string(context.psbt);
  const fee = psbt.fee().to_sat();
  const feeRate = psbt.fee_rate()?.to_sat_per_vb_floor();
  const total = BigInt(amount) + fee;
  const currency = networkToCurrencyUnit[network];

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          returnButtonName={ReviewTransactionEvent.HeaderBack}
          heading={t('review')}
        />

        <Box alignment="center" center>
          <AssetIcon network={network} />
          <Heading size="lg">{displayAmount(BigInt(amount), currency)}</Heading>
          <SnapText color="muted">
            {displayExchangeAmount(BigInt(amount), exchangeRate)}
          </SnapText>
        </Box>

        <Section>
          <Row label={t('from')}>
            <Link href={displayExplorerUrl(explorerUrl, from)}>
              <Address
                address={`${networkToScope[network]}:${from}` as CaipAccountId}
                displayName
              />
            </Link>
          </Row>
          <Row label={t('recipient')}>
            <Link href={displayExplorerUrl(explorerUrl, recipient)}>
              <Address
                address={
                  `${networkToScope[network]}:${recipient}` as CaipAccountId
                }
                displayName
              />
            </Link>
          </Row>
        </Section>

        <Section>
          <Row
            label={t('transactionSpeed')}
            tooltip={t('transactionSpeedTooltip')}
          >
            <SnapText>
              {`${Config.targetBlocksConfirmation * BlockTime[network]} ${t(
                'minutes',
              )}`}
            </SnapText>
          </Row>
          <Row label={t('networkFee')} tooltip={t('networkFeeTooltip')}>
            <Value
              value={`${fee} sats`}
              extra={displayExchangeAmount(BigInt(fee), exchangeRate)}
            />
          </Row>
          <Row label={t('feeRate')}>
            <SnapText>{`${feeRate} sat/vB`}</SnapText>
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
