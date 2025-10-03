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

import type { Messages, ConfirmSendFormContext } from '../../../entities';
import { networkToCurrencyUnit, ConfirmationEvent } from '../../../entities';
import {
  displayAmount,
  displayCaip10,
  displayExchangeAmount,
  displayExplorerUrl,
  isValidSnapLinkProtocol,
  translate,
} from '../format';

export type UnifiedSendFormViewProps = {
  context: ConfirmSendFormContext;
  messages: Messages;
};

export const UnifiedSendFormView: SnapComponent<UnifiedSendFormViewProps> = ({
  context,
  messages,
}) => {
  const t = translate(messages);
  const { amount, exchangeRate, network, from, explorerUrl } = context;

  const psbt = Psbt.from_string(context.psbt);
  const fee = psbt.fee().to_sat();
  const currency = networkToCurrencyUnit[network];

  return (
    <Container>
      <Box>
        <Heading size="lg">{t('Transaction request')}</Heading>

        <Section>
          <Row label={t('Estimated changes')} variant="default">
            <SnapText> </SnapText>
          </Row>
          <Row label={t('You send')}>
            <Box alignment="end">
              <SnapText>{displayAmount(BigInt(amount), currency)}</SnapText>
              <SnapText color="muted">
                {displayExchangeAmount(BigInt(amount), exchangeRate)}
              </SnapText>
            </Box>
          </Row>
        </Section>

        <Section>
          <Row label={t('Request from')}>
            <SnapText>MetaMask</SnapText>
          </Row>
          <Row label={t('Account')}>
            {isValidSnapLinkProtocol(explorerUrl) ? (
              <Link href={displayExplorerUrl(explorerUrl, from)}>
                <Address address={displayCaip10(network, from)} displayName />
              </Link>
            ) : (
              <Address address={displayCaip10(network, from)} displayName />
            )}
          </Row>
          <Row label={t('Network')}>
            <SnapText>{network}</SnapText>
          </Row>
          <Row label={t('Network fee')} tooltip={t('networkFeeTooltip')}>
            <Value
              value={displayAmount(fee, currency)}
              extra={displayExchangeAmount(fee, exchangeRate)}
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
