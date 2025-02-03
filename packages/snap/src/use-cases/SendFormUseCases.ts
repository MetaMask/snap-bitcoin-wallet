import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import {
  CurrencyUnit,
  networkToCurrencyUnit,
  SendFormContext,
  SendFormEvent,
  TransactionRequest,
  type BitcoinAccountRepository,
  type BlockchainClient,
  type SendFormRepository,
} from '../entities';
import type { SnapClient } from '../entities/snap';
import { logger } from '../utils';

export class SendFormUseCases {
  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #sendFormRepository: SendFormRepository;

  readonly #chain: BlockchainClient;

  constructor(
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFormrepository: SendFormRepository,
    chain: BlockchainClient,
  ) {
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFormRepository = sendFormrepository;
    this.#chain = chain;
  }

  async display(accountId: string): Promise<TransactionRequest> {
    logger.debug('Executing Send flow. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const formContext: SendFormContext = {
      currency: CurrencyUnit.Bitcoin,
      account: account.id,
      request: {},
    };
    // TODO: Move rate fetching to cron job
    // Only get the rate when on mainnet as other currencies have no exchange value
    if (networkToCurrencyUnit[account.network] === CurrencyUnit.Bitcoin) {
      formContext.fiatRate = await this.#snapClient.getBtcRate();
    }

    const formId = await this.#sendFormRepository.insert(account, formContext);

    // Blocks and waits for user actions
    const request = await this.#snapClient.displayInterface<TransactionRequest>(
      formId,
    );

    if (!request) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    logger.info('Bitcoin Send flow executed successfully: %s', formId);
    return request;
  }

  async update(
    id: string,
    event: SendFormEvent,
    context: SendFormContext,
  ): Promise<void> {
    logger.trace('Updating Send form. ID: %s. Event: %s', id, event);

    const account = await this.#accountRepository.get(context.account);
    if (!account) {
      logger.warn('Missing account in Send form. ID: %s', context.account);
      return await this.#snapClient.resolveInterface(id, null);
    }

    switch (event) {
      case SendFormEvent.HeaderBack: {
        await this.#snapClient.resolveInterface(id, null);
        break;
      }
      case SendFormEvent.Clear:
        context.request.recipient = '';
        await this.#sendFormRepository.update(id, account, context);
        break;
      case SendFormEvent.Cancel:
      case SendFormEvent.Close: {
        await this.#snapClient.resolveInterface(id, null);
        break;
      }
      case SendFormEvent.SwapCurrencyDisplay: {
        context.currency =
          context.currency === CurrencyUnit.Bitcoin
            ? CurrencyUnit.Fiat
            : CurrencyUnit.Bitcoin;
        await this.#sendFormRepository.update(id, account, context);
        break;
      }
      case SendFormEvent.Review: {
        // TODO: Implement confirmation screen
        console.log('display confirmation form');
        //await displayConfirmationReview({ request: context.request });
        break;
      }
      case SendFormEvent.SetMax: {
        context.request.amount = account.balance.trusted_spendable.to_btc();
        await this.#sendFormRepository.update(id, account, context);
        break;
      }
      default:
        break;
    }

    logger.debug('Send form updated successfully: %s', id);
  }
}
