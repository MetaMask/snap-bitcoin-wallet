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
import type { Network } from 'bitcoindevkit';

import type { SendFormContext } from '../../../entities';
import { SENDFORM_NAME, SendFormEvent } from '../../../entities';
import { getTranslator } from '../../../entities/locale';
import { displayAmount } from '../format';
import btcIcon from '../images/bitcoin.svg';
import signetIcon from '../images/signet.svg';
import testnetIcon from '../images/testnet.svg';

const networkToIcon: Record<Network, string> = {
  bitcoin: btcIcon,
  testnet: testnetIcon,
  testnet4: testnetIcon,
  signet: signetIcon,
  regtest: signetIcon,
};

export const SendForm: SnapComponent<SendFormContext> = ({
  currency,
  balance,
  amount,
  recipient,
  errors,
  network,
}) => {
  const t = getTranslator();

  const validAddress = Boolean(recipient && !errors.recipient);

  return (
    <Form name={SENDFORM_NAME}>
      <Field label={t('sendAmount')} error={errors.amount}>
        <Box direction="horizontal" center>
          <Image src={networkToIcon[network]} />
        </Box>
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
