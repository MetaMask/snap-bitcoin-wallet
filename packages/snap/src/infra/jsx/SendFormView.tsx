import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Icon,
  Image,
  Row,
  Text,
} from '@metamask/snaps-sdk/jsx';

import type { SendFormContext } from '../../entities';
import { SendFormEvent } from '../../entities';
import emptySpace from '../../images/empty-space.svg';
import { getTranslator } from '../../utils/locale';
import { SendForm, TransactionSummary } from './components';

export const SendFormView: SnapComponent<SendFormContext> = (props) => {
  const t = getTranslator();

  return (
    <Container>
      <Box>
        <Box direction="horizontal" alignment="space-between" center>
          <Button name={SendFormEvent.HeaderBack}>
            <Icon name="arrow-left" color="primary" size="md" />
          </Button>
          <Heading size="sm">{t('send')}</Heading>
          {/* FIXME: This empty space is needed to center-align the header text.
           * The Snap UI centers the text within its container, but the container
           * itself is misaligned in the header due to the back arrow.
           */}
          <Image src={emptySpace} />
        </Box>

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
        <Button name={SendFormEvent.Cancel}>{t('cancel')}</Button>
        <Button name={SendFormEvent.Review} disabled={props.fee === undefined}>
          {t('review')}
        </Button>
      </Footer>
    </Container>
  );
};
