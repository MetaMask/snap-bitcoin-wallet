import { Psbt } from '@metamask/bitcoindevkit';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Address,
  Heading,
  Link,
  Section,
  Box,
  Button,
  Container,
  Footer,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';

import type { Messages, ConfirmSendFormContext } from '../../../entities';
import { ConfirmationEvent, networkToCurrencyUnit } from '../../../entities';
import { AssetIconInline } from '../components';
import {
  displayAmount,
  displayCaip10,
  displayExchangeAmount,
  displayExplorerUrl,
  displayNetwork,
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
  const { amount, exchangeRate, network, from, recipient, explorerUrl } =
    context;

  const psbt = Psbt.from_string(context.psbt);
  const fee = psbt.fee().to_sat();
  const currency = networkToCurrencyUnit[network];

  return (
    <Container>
      <Box>
        <Box alignment="center" center>
          <Box>{null}</Box>
          <Heading size="lg">
            {t('confirmation.signAndSendTransaction.title')}
          </Heading>
          <Box>{null}</Box>
        </Box>

        <Section>
          <Box>
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.estimatedChanges')}
            </SnapText>
          </Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.estimatedChanges.send')}
            </SnapText>
            <Box direction="vertical" crossAlignment="end">
              <Box direction="horizontal" center>
                <SnapText color="error">
                  -{displayAmount(BigInt(amount), currency).replace(' BTC', '')}
                </SnapText>
                <AssetIconInline network={network} />
                <SnapText>BTC</SnapText>
              </Box>
              <SnapText color="muted">
                {displayExchangeAmount(BigInt(amount), exchangeRate)}
              </SnapText>
            </Box>
          </Box>
        </Section>

        <Section>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.requestOrigin')}
            </SnapText>
            <SnapText>MetaMask</SnapText>
          </Box>
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('from')}
            </SnapText>
            {isValidSnapLinkProtocol(explorerUrl) ? (
              <Link href={displayExplorerUrl(explorerUrl, from)}>
                <Address address={displayCaip10(network, from)} displayName />
              </Link>
            ) : (
              <Address address={displayCaip10(network, from)} displayName />
            )}
          </Box>
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('toAddress')}
            </SnapText>
            {isValidSnapLinkProtocol(explorerUrl) ? (
              <Link href={displayExplorerUrl(explorerUrl, recipient)}>
                <Address
                  address={displayCaip10(network, recipient)}
                  truncate
                  displayName
                  avatar
                />
              </Link>
            ) : (
              <Address
                address={displayCaip10(network, recipient)}
                truncate
                displayName
                avatar
              />
            )}
          </Box>
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('network')}
            </SnapText>
            <Box direction="horizontal" center>
              <AssetIconInline network={network} variant="network" />
              <SnapText>{displayNetwork(network)}</SnapText>
            </Box>
          </Box>
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('networkFee')}
            </SnapText>
            <Box direction="horizontal" alignment="center">
              <SnapText color="muted">
                {displayExchangeAmount(fee, exchangeRate)}
              </SnapText>
              <SnapText>{displayAmount(fee, currency)}</SnapText>
            </Box>
          </Box>
        </Section>
      </Box>

      <Footer>
        <Button name={ConfirmationEvent.Cancel}>{t('cancel')}</Button>
        <Button name={ConfirmationEvent.Confirm}>
          {t('confirmation.confirmButton')}
        </Button>
      </Footer>
    </Container>
  );
};
