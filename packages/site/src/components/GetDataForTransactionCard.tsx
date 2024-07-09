import { Card, GetDataForTransactionButton } from '.';
import { useInvokeSnap } from '../hooks';

export const GetDataForTransactionCard = ({
  enabled,
  fullWidth,
  account,
  scope,
}: {
  enabled: boolean;
  fullWidth: boolean;
  account: string;
  scope: string;
}) => {
  const invokeSnap = useInvokeSnap();

  const handleClick = async () => {
    const resp = await invokeSnap({
      method: 'chain_getDataForTransaction',
      params: {
        account,
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
        title: 'Get Data For Transaction',
        description: `Get Data For Transaction`,
        button: (
          <GetDataForTransactionButton
            onClick={handleClick}
            disabled={!enabled}
          />
        ),
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
