import type { KeyringAccount } from '@metamask/keyring-api';
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

import type { SendFlowParams } from '../../stateManagement';
import { getTranslator } from '../../utils/locale';
import { SendForm } from './SendForm';
import { TransactionSummary } from './TransactionSummary';
import { SendFormEvent } from '../../entities';
import emptySpace from '../images/empty-space.svg';

/**
 * The props for the {@link SendFlow} component.
 *
 * @property account - The account information for the transaction.
 * @property flushToAddress - Flag to flush to address.
 * @property sendFlowParams - Additional parameters for the send flow.
 * @property currencySwitched - Flag indicating if the currency was switched.
 * @property backEventTriggered - Flag indicating if the back event was triggered.
 */
export type SendFlowProps = {
  account: KeyringAccount;
  flushToAddress?: boolean;
  sendFlowParams: SendFlowParams;
  currencySwitched?: boolean;
  backEventTriggered?: boolean;
};

/**
 * A send flow component, which shows the user a form to send funds to another.
 *
 * @param props - The properties object.
 * @param props.account - The account information for the transaction.
 * @param props.flushToAddress - Flag to flush to address.
 * @param props.sendFlowParams - Additional parameters for the send flow.
 * @param props.currencySwitched - Flag indicating if the currency was switched.
 * @param props.backEventTriggered - Flag indicating if the back event was triggered.
 * @returns The rendered SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  account,
  sendFlowParams,
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
}) => {
  const t = getTranslator();
  const { amount, recipient, fees, total } = sendFlowParams;

  const disabledReview = Boolean(
    !amount.valid ||
      !recipient.valid ||
      !total.valid ||
      fees.loading ||
      fees.error,
  );

  const showTransactionSummary =
    Boolean(!amount.error && amount.amount) || fees.loading;

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
          selectedAccount={account.address}
          accounts={[account]}
          flushToAddress={flushToAddress}
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
          {...sendFlowParams}
        />
        {showTransactionSummary && (
          <TransactionSummary
            fees={sendFlowParams.fees}
            total={sendFlowParams.total}
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
