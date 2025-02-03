import type {
  BitcoinAccount,
  SendFormContext,
  UserInterface,
} from '../entities';
import { SendFormView } from './jsx/SendFormView';

export class JSXSendFormAdapter implements UserInterface {
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

  component() {
    return (
      <SendFormView
        balanceSats={this.#account.balance.trusted_spendable
          .to_sat()
          .toString()}
        {...this.#context}
      />
    );
  }

  get context(): SendFormContext {
    return this.#context;
  }
}
