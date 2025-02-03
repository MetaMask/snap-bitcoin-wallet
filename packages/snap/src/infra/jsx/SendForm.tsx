import {
  Box,
  Button,
  Field,
  Form,
  Icon,
  Image,
  Input,
  Text,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
import { Amount } from 'bitcoindevkit';

import { SendFormEvent } from '../../entities';
import btcIcon from '../../images/bitcoin.svg';
import { getTranslator } from '../../utils/locale';
import type { SendFormViewProps } from './SendFormView';

export type SendFormProps = SendFormViewProps & {
  flushToAddress?: boolean;
  currencySwitched: boolean;
  backEventTriggered: boolean;
};

const displayAmount = (amountSats?: string): string => {
  return amountSats
    ? Amount.from_sat(BigInt(amountSats)).to_btc().toString()
    : '';
};

export const SendForm: SnapComponent<SendFormProps> = ({
  currency,
  balanceSats,
  amountSats,
  recipient,
  fiatRate,
}) => {
  const t = getTranslator();

  return (
    <Form name="sendForm">
      <Field label={t('sendAmount')} error={''}>
        <Box direction="horizontal" center>
          <Image src={btcIcon} />
        </Box>
        <Input
          name={SendFormEvent.Amount}
          type="number"
          min={0}
          step={0.00000001}
          placeholder={t('amountToSendPlaceholder')}
          value={displayAmount(amountSats)}
        />
        {Boolean(fiatRate) && (
          <Box direction="horizontal" center>
            <Text color="alternative">{currency}</Text>
            <Button name={SendFormEvent.SwapCurrencyDisplay}>
              <Icon name="swap-vertical" color="primary" size="md" />
            </Button>
          </Box>
        )}
      </Field>
      <Box
        direction="horizontal"
        alignment={displayAmount(balanceSats) ? 'space-between' : 'end'}
      >
        <Box direction="horizontal">
          <Text color="muted">
            {`${t('balance')}: ${displayAmount(amountSats)} ${currency}`}
          </Text>
        </Box>

        <Button name={SendFormEvent.SetMax}>{t('max')}</Button>
      </Box>
      <Field label={t('toAccount')} error={''}>
        <Input
          name={SendFormEvent.To}
          placeholder={t('receivingAddressPlaceholder')}
          value={recipient ?? ''}
        />
        {Boolean(recipient) && (
          <Box>
            <Button name={SendFormEvent.Clear}>
              <Icon name={SendFormEvent.Close} color="primary" />
            </Button>
          </Box>
        )}
      </Field>
    </Form>
  );
};
