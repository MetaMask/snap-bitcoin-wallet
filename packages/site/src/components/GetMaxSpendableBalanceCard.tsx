import { Card, EstimateFeesButton } from '.';
import { useInvokeSnap } from '../hooks';

export const GetMaxSpendableBalanceCard = ({
  enabled,
  fullWidth,
  account,
}: {
  enabled: boolean;
  fullWidth: boolean;
  account: string;
}) => {
  const invokeSnap = useInvokeSnap();

  const handleClick = async () => {
    await invokeSnap({
      method: 'getMaxSpendableBalance',
      params: {
        account,
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Get Max Spendable Balance',
        description: `Get Max Spendable Balance`,
        button: (
          <EstimateFeesButton onClick={handleClick} disabled={!enabled} />
        ),
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
