import {
  Row,
  Section,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
import { Amount } from 'bitcoindevkit';

import { getTranslator } from '../../utils/locale';
import type { SendFormViewProps } from './SendFormView';

export type TransactionSummaryProps = {
  currency: SendFormViewProps['currency'];
  amountSats: string;
  feeSats: string;
  fiatRate?: SendFormViewProps['fiatRate'];
};

const displayFiatAmount = (amount: Amount, rate?: number): string => {
  return rate ? (amount.to_sat() * BigInt(rate)).toString(2) : '';
};

export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  feeSats,
  amountSats,
  currency,
  fiatRate,
}) => {
  const t = getTranslator();

  const totalSats = BigInt(amountSats) + BigInt(feeSats);
  const totalAmount = Amount.from_sat(totalSats);
  const fee = Amount.from_sat(BigInt(feeSats));

  return (
    <Section>
      <Row label={t('networkFee')} tooltip={t('networkFeeTooltip')}>
        <Value
          value={`${fee.to_btc()} ${currency}`}
          extra={displayFiatAmount(fee, fiatRate)}
        />
      </Row>
      <Row label={t('transactionSpeed')} tooltip={t('transactionSpeedTooltip')}>
        <Text>{t('estimatedTransactionSpeed')}</Text>
      </Row>
      <Row label={t('total')}>
        <Value
          value={`${totalAmount.to_btc()} ${currency}`}
          extra={displayFiatAmount(totalAmount, fiatRate)}
        />
      </Row>
    </Section>
  );
};
