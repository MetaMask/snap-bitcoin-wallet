import { Card, EstimateFeesButton } from '.';
import { useInvokeSnap } from '../hooks';

export const EstimateFeesCard = ({
  enabled,
  fullWidth,
  scope,
}: {
  enabled: boolean;
  fullWidth: boolean;
  scope: string;
}) => {
  const invokeSnap = useInvokeSnap();

  const handleClick = async () => {
    await invokeSnap({
      method: 'chain_estimateFees',
      params: {
        scope,
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Estimate Fees',
        description: `Estimate Fees`,
        button: (
          <EstimateFeesButton onClick={handleClick} disabled={!enabled} />
        ),
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
