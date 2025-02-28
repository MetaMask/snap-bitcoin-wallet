import type { CurrencyRate } from '@metamask/snaps-sdk';
import {
  Row,
  Section,
  Text,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
import type { Network } from 'bitcoindevkit';

import { Config } from '../../../config';
import { BlockTime, type CurrencyUnit } from '../../../entities';
import { getTranslator } from '../../../entities/locale';
import { displayAmount, displayExchangeAmount } from '../format';

type TransactionSummaryProps = {
  currency: CurrencyUnit;
  exchangeRate?: CurrencyRate;
  amount: string;
  fee: string;
  network: Network;
};

export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  fee,
  amount,
  currency,
  exchangeRate,
  network,
}) => {
  const t = getTranslator();

  const total = BigInt(amount) + BigInt(fee);

  return (
    <Section>
      <Row label={t('transactionSpeed')} tooltip={t('transactionSpeedTooltip')}>
        <Text>{`${Config.targetBlocksConfirmation * BlockTime[network]} ${t(
          'minutes',
        )}`}</Text>
      </Row>
      <Row label={t('transactionFee')} tooltip={t('transactionFeeTooltip')}>
        <Value
          value={`${fee} sats`}
          extra={displayExchangeAmount(BigInt(fee), exchangeRate)}
        />
      </Row>
      <Row label={t('total')}>
        <Value
          value={displayAmount(total, currency)}
          extra={displayExchangeAmount(total, exchangeRate)}
        />
      </Row>
    </Section>
  );
};
