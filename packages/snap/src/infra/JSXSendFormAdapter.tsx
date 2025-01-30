import {
  Box,
  Button,
  Footer,
  Heading,
  Icon,
  Image,
  JSXElement,
} from '@metamask/snaps-sdk/jsx';
import { BitcoinAccount, SendFormEvents, type SendForm } from '../entities';
import { Json } from '@metamask/utils';
import { getTranslator, Translator } from '../utils/locale';
import emptySpace from '../ui/images/empty-space.svg';
import { TransactionSummary } from '../ui/components/TransactionSummary';
import { SendForm as JSXSendForm } from '../ui/components/SendForm';
import { SendFlowParams } from '../stateManagement';
import { SendFlow } from '../ui/components';
import { generateDefaultSendFlowParams } from '../utils/transaction';
import { networkToCaip2 } from '../handlers/caip2';
import { snapToKeyringAccount } from '../handlers/keyring-account';
import { KeyringAccount } from '@metamask/keyring-api';

export class JSXSendFormAdapter implements SendForm {
  readonly #id: string;

  readonly #t: Translator;

  readonly #params: SendFlowParams;

  readonly #account: KeyringAccount;

  constructor(id: string, params: SendFlowParams, account: KeyringAccount) {
    this.#id = id;
    this.#t = getTranslator();
    this.#params = params;
    this.#account = account;
  }

  static create(id: string, account: BitcoinAccount): JSXSendFormAdapter {
    const params = generateDefaultSendFlowParams(
      networkToCaip2[account.network],
    );
    return new JSXSendFormAdapter(id, params, snapToKeyringAccount(account));
  }

  get id(): string {
    return this.#id;
  }

  component() {
    return <SendFlow account={this.#account} sendFlowParams={this.#params} />;

    // return () => {
    //   const showSummary =
    //     Boolean(!amount.error && amount.amount) || fees.loading;

    //   return (
    //     <Container>
    //       <Box>
    //         {this.#header()}
    //         {this.#form()}
    //         {showSummary && this.#summary()}
    //       </Box>
    //       {this.#footer()}
    //     </Container>
    //   );
    // };
  }

  context(): Record<string, Json> {
    return {};
  }

  // #header() {
  //   return (
  //     <Box direction="horizontal" alignment="space-between" center>
  //       <Button name={SendFormEvents.HeaderBack}>
  //         <Icon name="arrow-left" color="primary" size="md" />
  //       </Button>
  //       <Heading size="sm">{this.#t('send')}</Heading>
  //       {/* FIXME: This empty space is needed to center-align the header text.
  //        * The Snap UI centers the text within its container, but the container
  //        * itself is misaligned in the header due to the back arrow.
  //        */}
  //       <Image src={emptySpace} />
  //     </Box>
  //   );
  // }

  // #form() {
  //   return (
  //     <JSXSendForm
  //       selectedAccount={account.address}
  //       accounts={[account]}
  //       flushToAddress={this.#props.flushToAddress}
  //       currencySwitched={currencySwitched}
  //       backEventTriggered={backEventTriggered}
  //       {...sendFlowParams}
  //     />
  //   );
  // }

  // #summary() {
  //   return (
  //     <TransactionSummary
  //       fees={sendFlowParams.fees}
  //       total={sendFlowParams.total}
  //     />
  //   );
  // }

  // #footer() {
  //   const disabledReview = Boolean(
  //     !amount.valid ||
  //       !recipient.valid ||
  //       !total.valid ||
  //       fees.loading ||
  //       fees.error,
  //   );

  //   return (
  //     <Footer>
  //       <Button name={SendFormEvents.Cancel}>{this.#t('cancel')}</Button>
  //       <Button name={SendFormEvents.Review} disabled={disabledReview}>
  //         {this.#t('review')}
  //       </Button>
  //     </Footer>
  //   );
  // }
}
