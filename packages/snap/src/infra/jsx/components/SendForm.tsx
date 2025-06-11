import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import {
  AccountSelector,
  AssetSelector,
  Box,
  Button,
  Field,
  Form,
  Icon,
  Input,
  Text as SnapText,
} from '@metamask/snaps-sdk/jsx';
import type { CaipAccountId } from '@metamask/utils';

import type { Messages, SendFormContext } from '../../../entities';
import { CurrencyUnit, SENDFORM_NAME, SendFormEvent } from '../../../entities';
import { networkToCaip19, networkToScope } from '../../../handlers';
import {
  displayAmount,
  displayExchangeAmount,
  exchangeAmount,
  translate,
} from '../format';

type SendFormProps = SendFormContext & {
  messages: Messages;
};

export const SendForm = (props: SendFormProps): JSXElement => {
  const {
    currency,
    balance,
    amount,
    recipient,
    network,
    account,
    errors,
    messages,
    drain,
    exchangeRate,
  } = props;
  const t = translate(messages);

  const validAddress = Boolean(recipient && !errors.recipient);
  const chainId = networkToScope[network];
  const caip10Address = `${chainId}:${account.address}` as CaipAccountId;
  const isCurrencySwapped = currency === CurrencyUnit.Fiat;
  const amountValue = (): string => {
    if (!amount) {
      return '';
    }
    return isCurrencySwapped
      ? exchangeAmount(BigInt(amount), exchangeRate)
      : displayAmount(BigInt(amount));
  };

  return (
    <Form name={SENDFORM_NAME}>
      <Field label={t('from')}>
        <AccountSelector
          name={SendFormEvent.Account}
          chainIds={[chainId]}
          hideExternalAccounts
          switchGlobalAccount
          value={caip10Address}
        />
      </Field>

      <Box>{null}</Box>
      <Box>{null}</Box>
      <Box>{null}</Box>

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

      {validAddress && (
        <Box>
          <Box>{null}</Box>
          <Box>{null}</Box>
          <Box>{null}</Box>

          <Box direction="horizontal">
            <Field label={t('asset')}>
              <AssetSelector
                chainIds={[chainId]}
                value={networkToCaip19[network]}
                name={SendFormEvent.Asset}
                addresses={[caip10Address]}
              />
            </Field>

            <Field label={t('amount')} error={errors.amount}>
              <Input
                name={SendFormEvent.Amount}
                type="number"
                min={0}
                max={
                  isCurrencySwapped
                    ? Number(exchangeAmount(BigInt(balance)))
                    : Number(balance)
                }
                step={isCurrencySwapped ? 0.01 : 0.00000001}
                placeholder="0"
                value={amountValue()}
              />
              <Box direction="horizontal" center>
                <Box direction="vertical" alignment="center">
                  <SnapText size="sm">
                    {isCurrencySwapped && exchangeRate
                      ? exchangeRate.currency
                      : currency}
                  </SnapText>
                </Box>
                {exchangeRate && (
                  <Button name={SendFormEvent.SwitchCurrency}>
                    <Icon name="swap-vertical" size="md" color="primary" />
                  </Button>
                )}
              </Box>
            </Field>
          </Box>

          <Box direction="horizontal" alignment={'space-between'}>
            <SnapText size="sm" color="alternative">
              {`${t('balance')}: ${isCurrencySwapped ? displayExchangeAmount(BigInt(balance), exchangeRate) : displayAmount(BigInt(balance), currency)}`}
            </SnapText>

            {drain ? (
              <Button size="sm" name={SendFormEvent.ClearAmount}>
                {t('clear')}
              </Button>
            ) : (
              <Button size="sm" name={SendFormEvent.Max}>
                {t('max')}
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Form>
  );
};
