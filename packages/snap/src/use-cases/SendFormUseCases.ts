import type {
  BitcoinAccountRepository,
  BlockchainClient,
  SendForm,
  SendFormRepository,
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

  async create(accountId: string): Promise<SendForm> {
    logger.debug('Creating new Send form. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const sendForm = await this.#sendFormrepository.insert(account);
    const interfaceId = await this.#snapClient.createInterface(sendForm);
    const result = await this.#snapClient.displayInterface(interfaceId);

    console.log(result);

    logger.info('Bitcoin Send form created successfully: %s', sendForm.id);
    return sendForm;
  }
}
