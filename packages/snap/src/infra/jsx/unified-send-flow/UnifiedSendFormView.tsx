import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Banner,
  Box,
  Button,
  Container,
  Footer,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';

import type { Messages, UnifiedSendFormContext } from '../../../entities';
import { ConfirmationEvent } from '../../../entities';
import { SendForm } from '../components';
import { errorCodeToLabel, translate } from '../format';

export type UnifiedSendFormViewProps = {
  context: UnifiedSendFormContext;
  messages: Messages;
};

// TODO: This Form will need to be adjusted to the needs of unified send.
export const UnifiedSendFormView: SnapComponent<UnifiedSendFormViewProps> = ({
  context,
  messages,
}) => {
  const t = translate(messages);
  const { errors } = context;

  return (
    <Container>
      <Box>
        <SendForm {...context} messages={messages} />

        {errors.tx && (
          <Box>
            <Box>{null}</Box>
            <Banner title={t('error')} severity="warning">
              <SnapText size="sm">
                {t(errorCodeToLabel(errors.tx.code))}
              </SnapText>
            </Banner>
          </Box>
        )}
      </Box>

      <Footer>
        <Button name={ConfirmationEvent.Confirm} disabled={!context.fee}>
          {t('confirm')}
        </Button>
      </Footer>
    </Container>
  );
};
