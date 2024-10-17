import { BtcMethod } from '@metamask/keyring-api';
import { v4 as uuidV4 } from 'uuid';

import { Card, SendBitcoinButton } from '.';
import { useInvokeKeyring } from '../hooks';

export const SendBitcoinCard = ({
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
    await invokeKeyring({
      method: 'keyring_submitRequest',
      params: {
        account,
        id: uuidV4(),
        scope,
        request: {
          method: BtcMethod.SendBitcoin,
          params: {
            recipients: {
              [address]: '0.00000500',
            },
            replaceable: false,
            dryrun: true,
          },
        },
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Send Btc',
        description: `Send Btc`,
        button: <SendBitcoinButton onClick={handleClick} disabled={!enabled} />,
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
