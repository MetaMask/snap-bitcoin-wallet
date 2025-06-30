import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Banner,
  Box,
  Button,
  Container,
  Footer,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';

import { HeadingWithReturn, SendForm } from './components';
import { errorCodeToLabel, translate } from './format';
import type { Messages, SendFormContext } from '../../entities';
import { SendFormEvent } from '../../entities';

export type SendFormViewProps = {
  context: SendFormContext;
  messages: Messages;
};

export const SendFormView: SnapComponent<SendFormViewProps> = ({
  context,
  messages,
}) => {
  const t = translate(messages);
  const { errors } = context;

  console.log('context', context);

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          heading={t('send')}
          returnButtonName={SendFormEvent.Cancel}
        />

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
        <Button name={SendFormEvent.Confirm} disabled={!context.fee}>
          {t('continue')}
        </Button>
      </Footer>
    </Container>
  );
};
