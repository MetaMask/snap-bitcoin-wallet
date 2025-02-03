import type { BitcoinAccount, SendFormContext } from '../entities';
import { type SendForm } from '../entities';
import { networkToCaip2 } from '../handlers/caip2';
import { snapToKeyringAccount } from '../handlers/keyring-account';
import { SendFlow } from '../ui/components';
import { btcToFiat } from '../ui/utils';
import { SendFlowParams } from '../stateManagement';
import { AssetType } from '../ui/types';

export class JSXSendFormAdapter implements SendForm {
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
    const accountBalance = this.#account.balance.trusted_spendable
      .to_btc()
      .toString();
    const rates = this.#context.fiatRate?.toString() ?? '';
    console.log(rates);
    const fees = this.#context.request.feeRate?.toString() ?? '';
    const amount = this.#context.request.amount?.toString() ?? '';

    const params: SendFlowParams = {
      selectedCurrency: this.#context.currency as unknown as AssetType,
      recipient: {
        address: this.#context.request.recipient ?? '',
        error: '',
        valid: false,
      },
      fees: {
        amount: fees,
        fiat: btcToFiat(fees, rates),
        loading: false,
        error: '',
      },
      amount: {
        amount,
        fiat: btcToFiat(amount, rates),
        error: '',
        valid: false,
      },
      rates,
      balance: {
        amount: accountBalance,
        fiat: btcToFiat(accountBalance, rates),
      },
      total: {
        amount: '',
        fiat: '',
        error: '',
        valid: false,
      },
      scope: networkToCaip2[this.#account.network],
    };

    console.log(params);

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
