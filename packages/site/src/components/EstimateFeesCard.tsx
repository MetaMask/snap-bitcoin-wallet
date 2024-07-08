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
    const resp = await invokeSnap({
      method: 'chain_estimateFees',
      params: {
        scope,
      },
    });
    console.log({
      resp,
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
