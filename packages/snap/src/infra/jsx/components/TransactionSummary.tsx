import type { Network } from '@metamask/bitcoindevkit';
import type { CurrencyRate } from '@metamask/snaps-sdk';
import {
  Row,
  Section,
  Text as SnapText,
  Value,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { Config } from '../../../config';
import type { Messages, CurrencyUnit } from '../../../entities';
import { BlockTime } from '../../../entities';
import { displayAmount, displayExchangeAmount, translate } from '../format';

type TransactionSummaryProps = {
  currency: CurrencyUnit;
  exchangeRate?: CurrencyRate;
  amount: string;
  fee: string;
  network: Network;
  messages: Messages;
};

export const TransactionSummary: SnapComponent<TransactionSummaryProps> = ({
  fee,
  amount,
  currency,
  exchangeRate,
  network,
  messages,
}) => {
  const t = translate(messages);

  const total = BigInt(amount) + BigInt(fee);

  return (
    <Section>
      <Row label={t('transactionSpeed')} tooltip={t('transactionSpeedTooltip')}>
        <SnapText>{`${Config.targetBlocksConfirmation * BlockTime[network]} ${t(
          'minutes',
        )}`}</SnapText>
      </Row>
      <Row label={t('networkFee')} tooltip={t('networkFeeTooltip')}>
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
