import {
  Box,
  Button,
  Field,
  Form,
  Icon,
  Input,
  Text,
} from '@metamask/snaps-sdk/jsx';

import type { Messages, SendFormContext } from '../../../entities';
import { SENDFORM_NAME, SendFormEvent } from '../../../entities';
import { displayAmount, translate } from '../format';
import { AssetIcon } from './AssetIcon';

type SendFormProps = {
  currency: SendFormContext['currency'];
  balance: SendFormContext['balance'];
  amount: SendFormContext['amount'];
  recipient: SendFormContext['recipient'];
  errors: SendFormContext['errors'];
  network: SendFormContext['network'];
  messages: Messages;
};

export const SendForm = (props: SendFormProps) => {
  const { currency, balance, amount, recipient, errors, network, messages } =
    props;
  const t = translate(messages);

  const validAddress = Boolean(props.recipient && !errors.recipient);

  return (
    <Form name={SENDFORM_NAME}>
      <Field label={t('sendAmount')} error={errors.amount}>
        <AssetIcon network={network} />
        <Input
          name={SendFormEvent.Amount}
          type="number"
          min={0}
          step={0.00000001}
          placeholder={t('amountPlaceholder')}
          value={amount ? displayAmount(BigInt(amount)) : undefined}
        />
      </Field>
      <Box direction="horizontal" alignment={'space-between'}>
        <Box direction="horizontal">
          <Text color="alternative">
            {`${t('balance')}: ${displayAmount(BigInt(balance), currency)}`}
          </Text>
        </Box>

        <Button name={SendFormEvent.SetMax}>{t('max')}</Button>
      </Box>
      <Field label={t('toAddress')} error={errors.recipient}>
        <Input
          name={SendFormEvent.Recipient}
          placeholder={t('recipientPlaceholder')}
          value={recipient ?? ''}
        />
        {Boolean(recipient) && (
          <Box>
            <Button name={SendFormEvent.ClearRecipient}>
              <Icon name="close" color="primary" />
            </Button>
          </Box>
        )}
      </Field>
      {validAddress && <Icon name="check" color="primary" />}
    </Form>
  );
};
