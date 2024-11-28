import type { KeyringAccount } from '@metamask/keyring-api';
import {
  Card,
  Field,
  Selector,
  SelectorOption,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { shortenAddress } from '../../utils';
import type { Locale } from '../../utils/locale';
import jazzicon1 from '../images/jazzicon1.svg';
import type { Currency } from '../types';
import { displayEmptyStringIfAmountNotAvailableOrEmptyAmount } from '../utils';

/**
 * The props for the {@link AccountSelector} component.
 *
 * @property selectedAccount - The currently selected account.
 * @property balance - The balance of the selected account.
 * @property accounts - The available accounts.
 */
export type AccountSelectorProps = {
  locale: Locale;
  selectedAccount: string;
  balance: Currency;
  accounts: KeyringAccount[];
};

/**
 * A component that shows the account selector.
 *
 * @param props - The component props.
 * @param props.locale - The locale of the user.
 * @param props.selectedAccount - The currently selected account.
 * @param props.accounts - The available accounts.
 * @param props.balance - The balance of the selected account.
 * @returns The AccountSelector component.
 */
export const AccountSelector: SnapComponent<AccountSelectorProps> = ({
  locale,
  selectedAccount,
  accounts,
  balance,
}) => (
  <Field label={locale.fromAccount.message}>
    <Selector
      name="accountSelector"
      title={locale.fromAccount.message}
      value={selectedAccount}
    >
      {accounts.map(({ address }) => {
        return (
          <SelectorOption value={address}>
            <Card
              image={jazzicon1}
              description={shortenAddress(address)}
              value={
                balance?.amount
                  ? `${balance.amount.toString()} BTC`
                  : locale.loading.message
              }
              extra={
                balance?.fiat
                  ? `${displayEmptyStringIfAmountNotAvailableOrEmptyAmount(
                      balance.fiat,
                      '$',
                    )}`
                  : locale.loading.message
              }
              title={'Bitcoin Account'}
            />
          </SelectorOption>
        );
      })}
    </Selector>
  </Field>
);
