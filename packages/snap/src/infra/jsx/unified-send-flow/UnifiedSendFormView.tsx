import { Psbt } from '@metamask/bitcoindevkit';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Address,
  Heading,
  Link,
  Row,
  Section,
  Value,
  Box,
  Button,
  Container,
  Footer,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';

import { Config } from '../../../config';
import type { Messages, ConfirmSendFormContext } from '../../../entities';
import {
  BlockTime,
  networkToCurrencyUnit,
  ConfirmationEvent,
} from '../../../entities';
import { AssetIcon } from '../components';
import {
  displayAmount,
  displayCaip10,
  displayExchangeAmount,
  displayExplorerUrl,
  translate,
} from '../format';

export type UnifiedSendFormViewProps = {
  context: ConfirmSendFormContext;
  messages: Messages;
};

// TODO: This Form will need to be adjusted to the needs of unified send.
export const UnifiedSendFormView: SnapComponent<UnifiedSendFormViewProps> = ({
  context,
  messages,
}) => {
  const t = translate(messages);
  const { amount, recipient, exchangeRate, network, from, explorerUrl } =
    context;

  const psbt = Psbt.from_string(context.psbt);
  const fee = psbt.fee().to_sat();
  const feeRate = psbt.fee_rate()?.to_sat_per_vb_floor();
  const total = BigInt(amount) + fee;
  const currency = networkToCurrencyUnit[network];

  return (
    <Container>
      <Box>
        <Heading size="lg"> {t('Transaction request')} </Heading>

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
              <Address address={displayCaip10(network, from)} displayName />
            </Link>
          </Row>
          <Row label={t('recipient')}>
            <Link href={displayExplorerUrl(explorerUrl, recipient)}>
              <Address
                address={displayCaip10(network, recipient)}
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
        <Button name={ConfirmationEvent.Cancel} type="button">
          {t('Cancel')}
        </Button>
        <Button name={ConfirmationEvent.Confirm} type="button">
          {t('Confirm')}
        </Button>
      </Footer>
    </Container>
  );
};
