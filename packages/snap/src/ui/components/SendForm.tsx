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

import btcIcon from '../images/btc-halo.svg';
import jazzicon3 from '../images/jazzicon3.svg';
import { AccountWithBalance, AssetType } from '../utils';
import { AccountSelector } from './AccountSelector';
import { SendFlowParams } from '../../stateManagement';

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
}

/**
 * The props for the {@link SendForm} component.
 *
 * @property selectedAccount - The currently selected account.
 * @property accounts - The available accounts.
 * @property errors - The form errors.
 * @property selectedCurrency - The selected currency to display.
 * @property displayClearIcon - Whether to display the clear icon or not.
 * @property flushToAddress - Whether to flush the address field or not.
 */
export type SendFormProps = {
  selectedAccount: string;
  accounts: AccountWithBalance[];
  balance: SendFlowParams['balance'];
  amount: SendFlowParams['amount'];
  selectedCurrency: SendFlowParams['selectedCurrency'];
  recipient: SendFlowParams['recipient'];
  displayClearIcon: boolean;
  flushToAddress?: boolean;
  currencySwitched: boolean;
  backEventTriggered: boolean;
};

/**
 * A component that shows the send form.
 *
 * @param props - The component props.
 * @param props.selectedAccount - The currently selected account.
 * @param props.accounts - The available accounts.
 * @param props.balance - The balance of the account.
 * @param props.amount - The amount of the transaction from the formState.
 * @param props.errors - The form errors.
 * @param props.selectedCurrency - The selected currency to display.
 * @param props.displayClearIcon - Whether to display the clear icon or not.
 * @param props.flushToAddress - Whether to flush the address field or not.
 * @returns The SendForm component.
 */
export const SendForm: SnapComponent<SendFormProps> = ({
  selectedAccount,
  accounts,
  selectedCurrency,
  displayClearIcon,
  flushToAddress,
  balance,
  amount,
  recipient,
  currencySwitched,
  backEventTriggered,
}) => {
  const showRecipientError = recipient.address.length > 0 && !recipient.error;
  const valueToDisplay =
    currencySwitched || backEventTriggered
      ? selectedCurrency === AssetType.BTC
        ? amount.amount
        : amount.fiat
      : undefined;

  let addressToDisplay: string | undefined = undefined;
  if (backEventTriggered) {
    addressToDisplay = recipient.address;
  } else if (flushToAddress) {
    addressToDisplay = '';
  }

  return (
    <Form name="sendForm">
      <AccountSelector
        selectedAccount={selectedAccount}
        accounts={accounts}
        balance={balance}
      />
      <Field label="Send amount" error={amount.error}>
        <Box>
          <Image src={btcIcon} />
        </Box>
        <Input
          name={SendFormNames.Amount}
          type="number"
          placeholder="Enter amount to send"
          value={valueToDisplay}
        />
        <Box direction="horizontal" center>
          <Text color="alternative">{selectedCurrency}</Text>
          <Button name={SendFormNames.SwapCurrencyDisplay}>
            <Icon name="swap-vertical" color="primary" size="md" />
          </Button>
        </Box>
      </Field>
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
        {displayClearIcon && (
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
