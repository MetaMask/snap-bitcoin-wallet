import { UserRejectedRequestError } from '@metamask/snaps-sdk';

import type {
  BitcoinAccountRepository,
  SendFormRepository,
  SnapClient,
  BlockchainClient,
  TransactionRequest,
} from '../entities';
import { logger } from '../utils';

export class SendFormUseCases {
  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #sendFormRepository: SendFormRepository;

  readonly #chainClient: BlockchainClient;

  readonly #targetBlocksConfirmation: number;

  constructor(
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFormrepository: SendFormRepository,
    chainClient: BlockchainClient,
    targetBlocksConfirmation: number,
  ) {
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFormRepository = sendFormrepository;
    this.#chainClient = chainClient;
    this.#targetBlocksConfirmation = targetBlocksConfirmation;
  }

  async display(accountId: string): Promise<TransactionRequest> {
    logger.debug('Displaying Send form. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // TODO: Fetch fee rates from state and refresh on updates
    const feeEstimates = await this.#chainClient.getFeeEstimates(
      account.network,
    );
    const feeRate = feeEstimates.get(this.#targetBlocksConfirmation);
    if (!feeRate) {
      throw new Error('Failed to fetch fee rates');
    }

    const formId = await this.#sendFormRepository.insert(account, feeRate);

    // Blocks and waits for user actions
    const request = await this.#snapClient.displayInterface<TransactionRequest>(
      formId,
    );
    if (!request) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    logger.info('Send form resolved successfully: %s', formId);
    return request;
  }
}
