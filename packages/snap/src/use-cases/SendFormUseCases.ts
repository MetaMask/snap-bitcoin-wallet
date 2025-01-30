import type {
  BitcoinAccountRepository,
  BlockchainClient,
  SendForm,
  SendFormRepository,
} from '../entities';
import type { SnapClient } from '../entities/snap';
import { SendFlowRequest } from '../stateManagement';
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

  async create(accountId: string): Promise<SendForm> {
    logger.debug('Creating new Send form. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const sendForm = await this.#sendFormrepository.insert(account);

    logger.info('Bitcoin Send form created successfully: %s', sendForm.id);
    return sendForm;
  }

  async display(sendForm: SendForm): Promise<SendFlowRequest> {
    logger.trace('Displaying Send form. ID: %s', sendForm.id);

    const interfaceId = await this.#snapClient.createInterface(sendForm);
    const request = await this.#snapClient.displayInterface<SendFlowRequest>(
      interfaceId,
    ); // This blocks until the user has acted

    logger.debug('Send form resolved successfully: %s', sendForm.id);
    return request;
  }
}
