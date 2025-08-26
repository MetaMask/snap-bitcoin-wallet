import {
  Address,
  Box,
  Button,
  Container,
  Footer,
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
import { HeadingWithReturn } from '../components';
import { displayCaip10, displayOrigin, translate } from '../format';

type SignMessageConfirmationViewProps = {
  context: SignMessageConfirmationContext;
  messages: Messages;
};

export const SignMessageConfirmationView: SnapComponent<
  SignMessageConfirmationViewProps
> = ({ context, messages }) => {
  const t = translate(messages);
  const { account, network, origin, message } = context;
  const originHostname = origin ? displayOrigin(origin) : null;

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          heading={t('confirmation.signMessage.title')}
          returnButtonName={ConfirmationEvent.Cancel}
        />

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
        </Section>
      </Box>
      <Footer>
        <Button name={ConfirmationEvent.Cancel}>{t('cancel')}</Button>
        <Button name={ConfirmationEvent.Confirm}>
          {t('confirmation.signMessage.confirmButton')}
        </Button>
      </Footer>
    </Container>
  );
};
