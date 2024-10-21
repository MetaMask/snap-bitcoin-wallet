import {
  Box,
  Button,
  Field,
  Form,
  Icon,
  Image,
  Input,
  Text,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import type { SendFlowParams } from '../../stateManagement';
import btcIcon from '../images/btc-halo.svg';
import jazzicon3 from '../images/jazzicon3.svg';
import type { AccountWithBalance } from '../types';
import { AssetType } from '../types';
import { AccountSelector as AccountSelectorComponent } from './AccountSelector';

export enum SendFormNames {
  Amount = 'amount',
  To = 'to',
  SwapCurrencyDisplay = 'swap',
  AccountSelector = 'accountSelector',
  Clear = 'clear',
  Close = 'close',
  Review = 'review',
  Cancel = 'cancel',
  Send = 'send',
  HeaderBack = 'headerBack',
  SetMax = 'max',
}

/**
 * The props for the {@link SendForm} component.
 *
 * @property selectedAccount - The currently selected account.
 * @property accounts - The available accounts.
 * @property errors - The form errors.
 * @property selectedCurrency - The selected currency to display.
 * @property flushToAddress - Whether to flush the address field or not.
 */
export type SendFormProps = {
  selectedAccount: string;
  accounts: AccountWithBalance[];
  balance: SendFlowParams['balance'];
  amount: SendFlowParams['amount'];
  selectedCurrency: SendFlowParams['selectedCurrency'];
  recipient: SendFlowParams['recipient'];
  total: SendFlowParams['total'];
  flushToAddress?: boolean;
  currencySwitched: boolean;
  backEventTriggered: boolean;
};

const getAmountFrom = (
  selectedCurrency: AssetType,
  amount: SendFlowParams['amount'],
) => {
  return selectedCurrency === AssetType.BTC ? amount.amount : amount.fiat;
};

/**
 * A component that shows the send form.
 *
 * @param props - The component props.
 * @param props.selectedAccount - The currently selected account.
 * @param props.accounts - The available accounts.
 * @param props.balance - The balance of the account.
 * @param props.amount - The amount of the transaction from the formState.
 * @param props.selectedCurrency - The selected currency to display.
 * @param props.flushToAddress - Whether to flush the address field or not.
 * @param props.recipient - The recipient details including address and validation status.
 * @param props.total - The total amount including fees.
 * @param props.currencySwitched - Whether the currency display has been switched.
 * @param props.backEventTriggered - Whether the back event has been triggered.
 * @returns The SendForm component.
 */
export const SendForm: SnapComponent<SendFormProps> = ({
  selectedAccount,
  accounts,
  selectedCurrency,
  flushToAddress,
  balance,
  amount,
  recipient,
  total,
  currencySwitched,
  backEventTriggered,
}) => {
  const showRecipientError = recipient.address.length > 0 && !recipient.error;
  const amountToDisplay =
    currencySwitched || backEventTriggered
      ? getAmountFrom(selectedCurrency, amount)
      : undefined;

  let addressToDisplay: string | undefined;
  if (backEventTriggered) {
    addressToDisplay = recipient.address;
  } else if (flushToAddress) {
    addressToDisplay = '';
  }

  return (
    <Form name="sendForm">
      <AccountSelectorComponent
        selectedAccount={selectedAccount}
        accounts={accounts}
        balance={balance}
      />
      <Field label="Send amount" error={amount.error || total.error}>
        <Box direction="horizontal" center>
          <Image src={btcIcon} />
        </Box>
        <Input
          name={SendFormNames.Amount}
          type="number"
          min={0}
          step={0.00000001}
          placeholder="Enter amount to send"
          value={amountToDisplay}
        />
        <Box direction="horizontal" center>
          <Text color="alternative">
            {selectedCurrency === AssetType.FIAT ? 'USD' : selectedCurrency}
          </Text>
          <Button name={SendFormNames.SwapCurrencyDisplay}>
            <Icon name="swap-vertical" color="primary" size="md" />
          </Button>
        </Box>
      </Field>
      <Box
        direction="horizontal"
        alignment={balance.fiat ? 'space-between' : 'end'}
      >
        {Boolean(balance.fiat) && (
          <Text color="muted">{`Balance: $${balance.fiat.toLocaleLowerCase()}`}</Text>
        )}
        <Button name={SendFormNames.SetMax} disabled={Boolean(!balance.amount)}>
          Max
        </Button>
      </Box>
      <Field label="To account" error={recipient.error}>
        {recipient.valid && (
          <Box>
            <Image src={jazzicon3} />
          </Box>
        )}
        <Input
          name={SendFormNames.To}
          placeholder="Enter receiving address"
          value={addressToDisplay}
        />
        {Boolean(recipient.address) && (
          <Box>
            <Button name={SendFormNames.Clear}>
              <Icon name={SendFormNames.Close} color="primary" />
            </Button>
          </Box>
        )}
      </Field>
      {showRecipientError && <Text color="success">Valid bitcoin address</Text>}
    </Form>
  );
};
