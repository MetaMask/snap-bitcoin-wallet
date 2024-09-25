import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Container } from '@metamask/snaps-sdk/jsx';
import { BigNumber } from 'bignumber.js';

import type { Currency, SendFormErrors } from '../types';
import { SendFlowFooter } from './SendFlowFooter';
import { SendFlowHeader } from './SendFlowHeader';
import { SendForm } from './SendForm';
import { TransactionSummary } from './TransactionSummary';
import { convertBtcToFiat } from '../utils';

/**
 * The props for the {@link SendFlow} component.
 *
 * @property accounts - The available accounts.
 * @property selectedAccount - The currently selected account.
 * @property selectedCurrency - The selected currency to display.
 * @property amount - The amount to send of the transaction.
 * @property fees - The fees for the transaction.
 * @property displayClearIcon - Whether to display the clear icon or not.
 * @property flushToAddress - Whether to flush the address field or not.
 * @property errors - The form errors.
 */
export type SendFlowProps = {
  account: KeyringAccount;
  balance: Currency;
  amount: string;
  fees: Currency;
  rates: string;
  selectedCurrency: 'BTC' | '$';
  displayClearIcon: boolean;
  flushToAddress?: boolean;
  errors?: SendFormErrors;
  isLoading: boolean;
  canSubmit: boolean;
};

/**
 * A send flow component, which shows the user a form to send funds to another.
 *
 * @param props - The component props.
 * @param props.account - The selected account.
 * @param props.balance - The balance of the account.
 * @param props.amount - The amount of the transaction from formState.
 * @param props.selectedCurrency - The selected currency to display.
 * @param props.rates - The rates for the selected currency.
 * @param props.errors - The form errors.
 * @param props.fees - The fees for the transaction.
 * @param props.displayClearIcon - Whether to display the clear icon or not.
 * @param props.flushToAddress - Whether to flush the address field or not.
 * @param props.isLoading - Whether the transaction is loading or not.
 * @param props.canSubmit - Whether the form can be submitted or not.
 * @returns The SendFlow component.
 */
export const SendFlow: SnapComponent<SendFlowProps> = ({
  account,
  selectedCurrency,
  rates,
  fees,
  displayClearIcon,
  flushToAddress,
  errors,
  isLoading,
  balance,
  amount,
  canSubmit,
}) => {
  const totalAmount = new BigNumber(amount ?? '0')
    .plus(new BigNumber(fees.amount ?? '0'))
    .toString();
  const totalFiat = convertBtcToFiat(totalAmount, rates);

  return (
    <Container>
      <Box>
        <SendFlowHeader heading="Send" />
        <SendForm
          selectedAccount={account.address}
          accounts={[account]}
          selectedCurrency={selectedCurrency}
          flushToAddress={flushToAddress}
          displayClearIcon={displayClearIcon}
          errors={errors}
          balance={balance}
          amount={amount}
        />
        <TransactionSummary
          fees={fees}
          total={{
            amount: totalAmount,
            fiat: totalFiat,
          }}
          isLoading={isLoading}
          errors={errors}
        />
      </Box>
      <SendFlowFooter disabled={canSubmit} />
    </Container>
  );
};
