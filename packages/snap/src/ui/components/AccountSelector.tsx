import {
  Card,
  Field,
  Selector,
  SelectorOption,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
// import jazzicon from '@metamask/jazzicon';
import jazzicon1 from '../images/jazzicon1.svg';

import type { Account } from '../types';
import { truncate } from '../utils';
import { KeyringAccount } from '@metamask/keyring-api';
import { stringToBytes } from '@metamask/utils';

/**
 * The props for the {@link AccountSelector} component.
 *
 * @property selectedAccount - The currently selected account.
 * @property accounts - The available accounts.
 */
export type AccountSelectorProps = {
  selectedAccount: string;
  accounts: KeyringAccount[];
};

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
}) => (
  <Field label={'From account'}>
    <Selector
      name="accountSelector"
      title="From account"
      value={selectedAccount}
    >
      {accounts.map(({ address }) => {
        const addr = address.slice(2, 10);
        const seed = parseInt(addr, 16);
        // const image = jazzicon(46, seed);
        return (
          <SelectorOption value={address}>
            <Card
              image={jazzicon1}
              // title={name}
              description={truncate(address, 13)}
              // value={`${balance.amount.toString()} BTC`}
              // extra={`$${balance.fiat.toString()}`}
              title={'Btc Account'}
              value="1 BTC"
              extra="$64000 usd"
            />
          </SelectorOption>
        );
      })}
    </Selector>
  </Field>
);
