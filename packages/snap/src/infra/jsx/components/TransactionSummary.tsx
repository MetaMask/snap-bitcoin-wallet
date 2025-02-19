import type { CurrencyRate } from '@metamask/snaps-sdk';
import {
  Row,
  Section,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { Config } from '../../../config';
import type { CurrencyUnit } from '../../../entities';
import { getTranslator } from '../../../entities/locale';
import { displayAmount, displayFiatAmount } from '../format';

type TransactionSummaryProps = {
  currency: CurrencyUnit;
  fiatRate?: CurrencyRate;
  amount: string;
  fee: string;
};

export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  fee,
  amount,
  currency,
  fiatRate,
}) => {
  const t = getTranslator();

  const total = BigInt(amount) + BigInt(fee);

  return (
    <Section>
      <Row label={t('transactionFee')} tooltip={t('transactionFeeTooltip')}>
        <Value
          value={displayAmount(BigInt(fee), currency)}
          extra={displayFiatAmount(BigInt(fee), fiatRate)}
        />
      </Row>
      <Row label={t('transactionSpeed')} tooltip={t('transactionSpeedTooltip')}>
        <Text>{`${Config.targetBlocksConfirmation * 10} ${t('minutes')}`}</Text>
      </Row>
      <Row label={t('total')}>
        <Value
          value={displayAmount(total, currency)}
          extra={displayFiatAmount(total, fiatRate)}
        />
      </Row>
    </Section>
  );
};
