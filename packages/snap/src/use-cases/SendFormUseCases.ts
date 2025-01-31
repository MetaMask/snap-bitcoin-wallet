import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import {
  CurrencyUnit,
  networkToCurrencyUnit,
  SendFormContext,
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

  readonly #sendFormrepository: SendFormRepository;

  readonly #chain: BlockchainClient;

  constructor(
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFormrepository: SendFormRepository,
    chain: BlockchainClient,
  ) {
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFormrepository = sendFormrepository;
    this.#chain = chain;
  }

  async display(accountId: string): Promise<TransactionRequest> {
    logger.debug('Executing Send flow. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const formContext: SendFormContext = {
      account: account.id,
    };
    // Only get the rate when on mainnet as other currencies have no exchange value
    if (networkToCurrencyUnit[account.network] === CurrencyUnit.Bitcoin) {
      formContext.fiatRate = await this.#snapClient.getBtcRate();
    }

    const sendForm = await this.#sendFormrepository.insert(
      account,
      formContext,
    );

    // Blocks and waits for user actions
    const request = await this.#snapClient.displayInterface<TransactionRequest>(
      sendForm.id,
    );

    if (!request) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    logger.info('Bitcoin Send flow executed successfully: %s', sendForm.id);
    return request;
  }
}
