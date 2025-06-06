import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Banner,
  Box,
  Button,
  Container,
  Footer,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';
import { isNullOrUndefined } from '@metamask/utils';

import { HeadingWithReturn, SendForm } from './components';
import { translate } from './format';
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
  const { amount, recipient, errors } = context;
  const canReview =
    (amount ? amount.length > 0 : false) &&
    (recipient ? recipient.length > 0 : false) &&
    Object.values(errors).every(isNullOrUndefined);

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
              <SnapText size="sm">{t(errors.tx)}</SnapText>
            </Banner>
          </Box>
        )}
      </Box>

      <Footer>
        <Button name={SendFormEvent.Confirm} disabled={!canReview}>
          {t('continue')}
        </Button>
      </Footer>
    </Container>
  );
};
