import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod } from '@metamask/keyring-api';
import { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';

import { Card, SignMessageButton } from '.';
import { useInvokeKeyring } from '../hooks';

export const SignMessageCard = ({ account }: { account: KeyringAccount }) => {
  const invokeKeyring = useInvokeKeyring();
  const [message, setMessage] = useState('Hello, world!');

  const handleClick = async () => {
    await invokeKeyring({
      method: 'keyring_submitRequest',
      params: {
        account: account.id,
        id: uuidV4(),
        scope: account.scopes[0],
        request: {
          method: BtcMethod.SignMessage,
          params: {
            message,
          },
        },
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Sign Message',
        description: (
          <div>
            <label>
              Message:
              <input
                type="text"
                value={message}
                onChange={(changeEvent) => setMessage(changeEvent.target.value)}
                style={{ marginLeft: '10px' }}
              />
            </label>
          </div>
        ),
        button: <SignMessageButton onClick={handleClick} />,
      }}
    />
  );
};
