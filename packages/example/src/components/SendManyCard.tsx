import { v4 as uuidv4 } from 'uuid';

import { Card, SendManyButton } from '.';
import { useInvokeKeyring } from '../hooks';

export const SendManyCard = ({
  enabled,
  fullWidth,
  scope,
  account,
  address,
}: {
  enabled: boolean;
  fullWidth: boolean;
  scope: string;
  account: string;
  address: string;
}) => {
  const invokeKeyring = useInvokeKeyring();

  const handleClick = async () => {
   
    const resp = await invokeKeyring({
      method: 'keyring_submitRequest',
      params: {
        account: account,
        id: uuidv4(),
        scope: scope,
        request: {
          method: 'btc_sendmany',
          params: {
            amounts: {
              [address]: '0.00000500',
            },
            comment: 'some very long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long comment',
            subtractFeeFrom: [],
            replaceable: false,
            dryrun: true
          },
        },
      },
    });
  }

  return (
    <Card
      content={{
        title: 'Send Btc',
        description: `Send Btc`,
        button: <SendManyButton onClick={handleClick} disabled={!enabled} />,
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
