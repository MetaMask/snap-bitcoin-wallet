import type { KeyringAccount } from '@metamask/keyring-api';
import {
  Box,
  Button,
  Footer,
  Heading,
  Icon,
  Image,
  JSXElement,
} from '@metamask/snaps-sdk/jsx';
import type { Json } from '@metamask/utils';

import type { BitcoinAccount, SendFormContext, UIContext } from '../entities';
import { SendFormEvents, type SendForm } from '../entities';
import { networkToCaip2 } from '../handlers/caip2';
import { snapToKeyringAccount } from '../handlers/keyring-account';
import type { SendFlowParams } from '../stateManagement';
import { SendFlow } from '../ui/components';
import { SendForm as JSXSendForm } from '../ui/components/SendForm';
import { TransactionSummary } from '../ui/components/TransactionSummary';
import emptySpace from '../ui/images/empty-space.svg';
import type { Translator } from '../utils/locale';
import { getTranslator } from '../utils/locale';
import { generateDefaultSendFlowParams } from '../utils/transaction';
import { Amount } from 'bitcoindevkit';
import { btcToFiat } from '../ui/utils';
import { SendFlowContext } from '../ui/types';

export class JSXSendFormAdapter implements SendForm {
  #id: string;

  readonly #context: SendFormContext;

  readonly #account: BitcoinAccount;

  constructor(account: BitcoinAccount, context: SendFormContext) {
    this.#context = context;
    this.#account = account;
  }

  static create(
    account: BitcoinAccount,
    context: SendFormContext,
  ): JSXSendFormAdapter {
    return new JSXSendFormAdapter(account, context);
  }

  get id(): string {
    return this.#id;
  }

  set id(id: string) {
    this.#id = id;
  }

  component() {
    const params = generateDefaultSendFlowParams(
      networkToCaip2[this.#account.network],
    );
    params.rates = this.#context.fiatRate?.toString() ?? '';
    params.balance.amount = this.#account.balance.trusted_spendable
      .to_btc()
      .toString();
    // TODO: No need to have this value since it is computed from the balance and rate
    params.balance.fiat = btcToFiat(params.balance.amount, params.rates);

    return (
      <SendFlow
        account={snapToKeyringAccount(this.#account)}
        sendFlowParams={params}
      />
    );
  }

  get context(): SendFormContext {
    return this.#context;
  }
}
