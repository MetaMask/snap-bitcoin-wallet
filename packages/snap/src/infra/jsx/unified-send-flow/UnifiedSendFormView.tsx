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
        <Heading size="lg">
          {t('confirmation.signAndSendTransaction.title')}
        </Heading>

        <Section>
          <Row label={t('confirmation.estimatedChanges')} variant="default">
            <SnapText> </SnapText>
          </Row>
          <Row label={t('confirmation.estimatedChanges.send')}>
            <Box alignment="end">
              <SnapText>{displayAmount(BigInt(amount), currency)}</SnapText>
              <SnapText color="muted">
                {displayExchangeAmount(BigInt(amount), exchangeRate)}
              </SnapText>
            </Box>
          </Row>
        </Section>

        <Section>
          <Row label={t('confirmation.requestOrigin')}>
            <SnapText>MetaMask</SnapText>
          </Row>
          <Row label={t('confirmation.account')}>
            {isValidSnapLinkProtocol(explorerUrl) ? (
              <Link href={displayExplorerUrl(explorerUrl, from)}>
                <Address address={displayCaip10(network, from)} displayName />
              </Link>
            ) : (
              <Address address={displayCaip10(network, from)} displayName />
            )}
          </Row>
          <Row label={t('network')}>
            <SnapText>{network}</SnapText>
          </Row>
          <Row label={t('networkFee')} tooltip={t('networkFeeTooltip')}>
            <Value
              value={displayAmount(fee, currency)}
              extra={displayExchangeAmount(fee, exchangeRate)}
            />
          </Row>
        </Section>
      </Box>

      <Footer>
        <Button name={ConfirmationEvent.Cancel} type="button">
          {t('cancel')}
        </Button>
        <Button name={ConfirmationEvent.Confirm} type="button">
          {t('confirmation.confirmButton')}
        </Button>
      </Footer>
    </Container>
  );
};
