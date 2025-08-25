import {
  Address,
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Icon,
  Section,
  Text as SnapText,
  Tooltip,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import type {
  Messages,
  SignMessageConfirmationContext,
} from '../../../entities';
import { ConfirmationEvent } from '../../../entities';
import { networkToScope } from '../../../handlers';
import { AssetIcon } from '../components';
import { displayCaip10, parseOrigin, translate } from '../format';

type SignMessageConfirmationViewProps = {
  context: SignMessageConfirmationContext;
  messages: Messages;
};

export const SignMessageConfirmationView: SnapComponent<
  SignMessageConfirmationViewProps
> = ({ context, messages }) => {
  const t = translate(messages);
  const { account, network, origin, message } = context;
  const originHostname = origin ? parseOrigin(origin) : null;

  return (
    <Container>
      <Box>
        <Box alignment="center" center>
          <Box>{null}</Box>
          <Heading size="lg">{t('confirmation.signMessage.title')}</Heading>
        </Box>

        <Section>
          <Box direction="horizontal" center>
            <SnapText fontWeight="medium">
              {t('confirmation.signMessage.message')}
            </SnapText>
          </Box>
          <Box alignment="space-between">
            <SnapText>{message}</SnapText>
          </Box>
        </Section>

        <Section>
          {originHostname ? (
            <Box alignment="space-between" direction="horizontal">
              <Box alignment="space-between" direction="horizontal" center>
                <SnapText fontWeight="medium" color="alternative">
                  {t('confirmation.origin')}
                </SnapText>
                <Tooltip content={t('confirmation.origin.tooltip')}>
                  <Icon name="question" color="muted" />
                </Tooltip>
              </Box>
              <SnapText>{originHostname}</SnapText>
            </Box>
          ) : null}
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.account')}
            </SnapText>
            <Address
              address={displayCaip10(network, account.address)}
              displayName
            />
          </Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.network')}
            </SnapText>
            <Box direction="horizontal" alignment="center">
              <Box alignment="center" center>
                <AssetIcon network={network} />
              </Box>
              <SnapText>{networkToScope[network]}</SnapText>
            </Box>
          </Box>
        </Section>
      </Box>
      <Footer>
        <Button name={ConfirmationEvent.Cancel}>
          {t('confirmation.cancelButton')}
        </Button>
        <Button name={ConfirmationEvent.Confirm}>
          {t('confirmation.confirmButton')}
        </Button>
      </Footer>
    </Container>
  );
};
