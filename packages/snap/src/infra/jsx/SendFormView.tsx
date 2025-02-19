import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Button,
  Container,
  Footer,
  Row,
  Text,
} from '@metamask/snaps-sdk/jsx';

import type { SendFormContext } from '../../entities';
import { SendFormEvent } from '../../entities';
import { getTranslator } from '../../entities/locale';
import { HeadingWithReturn, SendForm, TransactionSummary } from './components';

export const SendFormView: SnapComponent<SendFormContext> = (props) => {
  const t = getTranslator();

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          heading={t('send')}
          returnButtonName={SendFormEvent.Cancel}
        />

        <SendForm {...props} />

        {props.errors.tx !== undefined && (
          <Row label={t('error')} variant="warning">
            <Text>{props.errors.tx}</Text>
          </Row>
        )}

        {props.fee !== undefined && props.amount !== undefined && (
          <TransactionSummary
            {...props}
            fee={props.fee}
            amount={props.amount}
          />
        )}
      </Box>

      <Footer>
        <Button name={SendFormEvent.Confirm} disabled={props.fee === undefined}>
          {t('review')}
        </Button>
      </Footer>
    </Container>
  );
};
