import type { CurrencyRate } from '@metamask/snaps-sdk';
import {
  Row,
  Section,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
import { Amount } from 'bitcoindevkit';

import { ConfigV2 } from '../../configv2';
import type { SendFormContext } from '../../entities';
import { getTranslator } from '../../utils/locale';

export type TransactionSummaryProps = SendFormContext & {
  amount: string;
  fee: string;
};

const displayFiatAmount = (amount: bigint, fiatRate?: CurrencyRate): string => {
  return fiatRate
    ? `${((Number(amount) * fiatRate.conversionRate) / 1e8).toFixed(2)} ${
        fiatRate.currency
      }`
    : '';
};

export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  fee,
  amount,
  currency,
  fiatRate,
}) => {
  const t = getTranslator();

  const txFee = Amount.from_sat(BigInt(fee));
  const total = Amount.from_sat(BigInt(amount) + BigInt(fee));

  return (
    <Section>
      <Row label={t('transactionFee')} tooltip={t('transactionFeeTooltip')}>
        <Value
          value={`${txFee.to_btc()} ${currency}`}
          extra={displayFiatAmount(txFee.to_sat(), fiatRate)}
        />
      </Row>
      <Row label={t('transactionSpeed')} tooltip={t('transactionSpeedTooltip')}>
        <Text>
          {`${ConfigV2.targetBlocksConfirmation * 10} ${t('minutes')}`}
        </Text>
      </Row>
      <Row label={t('total')}>
        <Value
          value={`${total.to_btc()} ${currency}`}
          extra={displayFiatAmount(total.to_sat(), fiatRate)}
        />
      </Row>
    </Section>
  );
};
