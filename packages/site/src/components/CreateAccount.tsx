import { KeyringRpcMethod } from '@metamask/keyring-api';

import { Card, GetTransactionStatusButton } from '.';
import { useInvokeKeyring } from '../hooks';

export const CreateAccount = ({
  fullWidth,
  scope,
}: {
  enabled: boolean;
  fullWidth: boolean;
  scope: string;
}) => {
  const invokeKeyring = useInvokeKeyring();

  const handleClick = async () => {
    await invokeKeyring({
      method: KeyringRpcMethod.CreateAccount,
      params: {
        options: {
          scope: 'bip122:000000000933ea01ad0ee984209779ba',
        },
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Create account',
        button: (
          <>
            <GetTransactionStatusButton
              onClick={handleClick}
              // disabled={!enabled || !transactionId}
            />
          </>
        ),
      }}
      // disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
