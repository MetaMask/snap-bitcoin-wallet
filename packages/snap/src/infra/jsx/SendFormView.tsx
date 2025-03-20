import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Button,
  Container,
  Footer,
  Row,
  Text,
} from '@metamask/snaps-sdk/jsx';

import type { Messages, SendFormContext } from '../../entities';
import { SendFormEvent } from '../../entities';
import { HeadingWithReturn, SendForm, TransactionSummary } from './components';
import { translate } from './format';

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

        <SendForm context={context} messages={messages} />

        {context.errors.tx !== undefined && (
          <Row label={t('error')} variant="warning">
            <Text>{context.errors.tx}</Text>
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
