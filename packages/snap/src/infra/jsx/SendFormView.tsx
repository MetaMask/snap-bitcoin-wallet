import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Icon,
  Image,
} from '@metamask/snaps-sdk/jsx';

import type { SendFormContext } from '../../entities';
import { SendFormEvent } from '../../entities';
import emptySpace from '../../images/empty-space.svg';
import { getTranslator } from '../../utils/locale';
import { SendForm } from './SendForm';
import { TransactionSummary } from './TransactionSummary';

export type SendFormViewProps = SendFormContext & {
  balance: string;
  flushToAddress?: boolean;
  currencySwitched?: boolean;
  backEventTriggered?: boolean;
};

export const SendFormView: SnapComponent<SendFormViewProps> = ({
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
  ...props
}) => {
  const t = getTranslator();

  const disabledReview = true;
  const showTransactionSummary = Boolean(props.amount && props.fee);

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

        <SendForm
          flushToAddress={flushToAddress}
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
          {...props}
        />
        {showTransactionSummary && (
          <TransactionSummary
            amountSats={props.amount!}
            feeSats={props.fee!}
            currency={props.currency}
            fiatRate={props.fiatRate}
          />
        )}
      </Box>

      <Footer>
        <Button name={SendFormEvent.Cancel}>{t('cancel')}</Button>
        <Button name={SendFormEvent.Review} disabled={disabledReview}>
          {t('review')}
        </Button>
      </Footer>
    </Container>
  );
};
