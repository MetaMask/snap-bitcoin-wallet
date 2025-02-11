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
import { CurrencyUnit } from '../../entities';
import { getTranslator } from '../../utils/locale';

export type TransactionSummaryProps = {
  currency: SendFormContext['currency'];
  amountSats: string;
  feeSats: string;
  fiatRate?: SendFormContext['fiatRate'];
};

const displayFiatAmount = (amount: Amount, fiatRate?: number): string => {
  return fiatRate
    ? `${((Number(amount.to_sat()) * fiatRate) / 1e8).toFixed(2)} ${
        CurrencyUnit.Fiat
      }`
    : '';
};

export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  feeSats,
  amountSats,
  currency,
  fiatRate,
}) => {
  const t = getTranslator();

  const total = Amount.from_sat(BigInt(amountSats) + BigInt(feeSats));
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
        <Text>
          {`${ConfigV2.chain.targetBlocksConfirmation * 10}`} {t('minutes')}
        </Text>
      </Row>
      <Row label={t('total')}>
        <Value
          value={`${total.to_btc()} ${currency}`}
          extra={displayFiatAmount(total, fiatRate)}
        />
      </Row>
    </Section>
  );
};
