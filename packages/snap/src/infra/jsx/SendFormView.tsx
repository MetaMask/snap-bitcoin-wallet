import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Button,
  Container,
  Footer,
  Row,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';

import { HeadingWithReturn, SendForm, TransactionSummary } from './components';
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

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          heading={t('send')}
          returnButtonName={SendFormEvent.Cancel}
        />

        <SendForm {...context} messages={messages} />

        {context.errors.tx !== undefined && (
          <Row label={t('error')} variant="warning">
            <SnapText>{context.errors.tx}</SnapText>
          </Row>
        )}

        {context.fee !== undefined && context.amount !== undefined && (
          <TransactionSummary
            {...context}
            fee={context.fee}
            amount={context.amount}
            messages={messages}
          />
        )}
      </Box>

      <Footer>
        <Button
          name={SendFormEvent.Confirm}
          disabled={context.fee === undefined}
        >
          {t('review')}
        </Button>
      </Footer>
    </Container>
  );
};
