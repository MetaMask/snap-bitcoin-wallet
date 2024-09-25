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

import btcIcon from '../images/btc.svg';
import jazzicon3 from '../images/jazzicon3.svg';
import type { Currency, SendFormErrors } from '../types';
import type { AccountWithBalance } from '../utils';
import { AccountSelector } from './AccountSelector';

export enum SendFormNames {
  Amount = 'amount',
  To = 'to',
  SwapCurrencyDisplay = 'swap',
  Clear = 'clear',
  Close = 'close',
  Review = 'review',
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
  balance: Currency;
  amount: string;
  errors?: SendFormErrors;
  selectedCurrency: 'BTC' | '$';
  displayClearIcon: boolean;
  flushToAddress?: boolean;
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
  errors,
  selectedCurrency,
  displayClearIcon,
  flushToAddress,
  balance,
  amount,
}) => {
  return (
    <Form name="sendForm">
      <AccountSelector
        selectedAccount={selectedAccount}
        accounts={accounts}
        balance={balance}
      />
      <Field label="Send amount" error={errors?.amount}>
        <Box>
          <Image src={btcIcon} />
        </Box>
        <Input
          name={SendFormNames.Amount}
          type="number"
          placeholder="Enter amount to send"
          value={amount}
        />
        <Box direction="horizontal" center>
          <Text color="alternative">{selectedCurrency}</Text>
          <Button name={SendFormNames.SwapCurrencyDisplay}>
            <Icon name="swap-vertical" color="primary" size="md" />
          </Button>
        </Box>
      </Field>
      <Field label="To account" error={errors?.to}>
        <Box>
          <Image src={jazzicon3} />
        </Box>
        <Input
          name={SendFormNames.To}
          placeholder="Enter receiving address"
          value={flushToAddress ? '' : undefined}
        />
        {displayClearIcon && (
          <Box>
            <Button name={SendFormNames.Clear}>
              <Icon name={SendFormNames.Close} color="primary" />
            </Button>
          </Box>
        )}
      </Field>
    </Form>
  );
};
