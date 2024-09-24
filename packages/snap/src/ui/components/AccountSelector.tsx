import {
  Card,
  Field,
  Selector,
  SelectorOption,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
// import jazzicon from '@metamask/jazzicon';
import jazzicon1 from '../images/jazzicon1.svg';

import { truncate } from '../utils';
import { KeyringAccount } from '@metamask/keyring-api';
import { Currency } from '../types';

/**
 * The props for the {@link AccountSelector} component.
 *
 * @property selectedAccount - The currently selected account.
 * @property accounts - The available accounts.
 */
export type AccountSelectorProps = {
  selectedAccount: string;
  balance: Currency;
  accounts: KeyringAccount[];
};

const loadingMessage = 'Loading';

/**
 * A component that shows the account selector.
 *
 * @param props - The component props.
 * @param props.selectedAccount - The currently selected account.
 * @param props.accounts - The available accounts.
 * @returns The AccountSelector component.
 */
export const AccountSelector: SnapComponent<AccountSelectorProps> = ({
  selectedAccount,
  accounts,
  balance,
}) => (
  <Field label={'From account'}>
    <Selector
      name="accountSelector"
      title="From account"
      value={selectedAccount}
    >
      {accounts.map(({ address }) => {
        return (
          <SelectorOption value={address}>
            <Card
              image={jazzicon1}
              description={truncate(address, 13)}
              value={
                balance?.amount
                  ? `${balance.amount.toString()} BTC`
                  : loadingMessage
              }
              extra={
                balance?.amount ? `$${balance.fiat.toString()}` : loadingMessage
              }
              title={'Btc Account'}
            />
          </SelectorOption>
        );
      })}
    </Selector>
  </Field>
);
