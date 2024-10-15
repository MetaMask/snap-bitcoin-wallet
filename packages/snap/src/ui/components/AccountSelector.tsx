import type { KeyringAccount } from '@metamask/keyring-api';
import {
  Card,
  Field,
  Selector,
  SelectorOption,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { shortenAddress } from '../../utils';
import jazzicon1 from '../images/jazzicon1.svg';
import type { Currency } from '../types';

/**
 * The props for the {@link AccountSelector} component.
 *
 * @property selectedAccount - The currently selected account.
 * @property balance - The balance of the selected account.
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
 * @param props.balance - The balance of the selected account.
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
              description={shortenAddress(address)}
              value={
                balance?.amount
                  ? `${balance.amount.toString()} BTC`
                  : loadingMessage
              }
              extra={
                balance?.amount ? `$${balance.fiat.toString()}` : loadingMessage
              }
              title={'Bitcoin Account'}
            />
          </SelectorOption>
        );
      })}
    </Selector>
  </Field>
);
