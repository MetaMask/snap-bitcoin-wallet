import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod } from '@metamask/keyring-api';
import { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';

import { Card, SendBitcoinButton } from '.';
import { useInvokeKeyring } from '../hooks';

export const SendBitcoinCard = ({ account }: { account: KeyringAccount }) => {
  const invokeKeyring = useInvokeKeyring();
  const [address, setAddress] = useState(
    'bc1q4degm5k044n9xv3ds7d8l6hfavydte6wn6sesw',
  );
  const [amount, setAmount] = useState('0.00000500');

  const handleClick = async () => {
    const response = (await invokeKeyring({
      method: 'keyring_submitRequest',
      params: {
        account: account.id,
        id: uuidV4(),
        scope: account.scopes[0],
        origin: 'http://localhost:3000',
        request: {
          method: `${BtcMethod.SendTransfer}`,
          params: {
            recipients: [
              {
                amount,
                address,
              },
            ],
          },
        },
      },
    })) as { result: { txid: string } };

    console.log(response.result.txid);
  };

  return (
    <Card
      content={{
        title: 'Send BTC',
        description: (
          <div>
            From: {account.address}
            <br />
            Scope: {account.scopes[0]}
            <br />
            <br />
            <label>
              To:
              <input
                type="text"
                value={address}
                onChange={(changeEvent) => setAddress(changeEvent.target.value)}
                style={{ marginLeft: '10px', width: '400px' }}
              />
            </label>
            <br />
            <label>
              Amount:
              <input
                type="text"
                value={amount}
                onChange={(changeEvent) => setAmount(changeEvent.target.value)}
                style={{ marginLeft: '10px' }}
              />
            </label>
          </div>
        ),
        button: <SendBitcoinButton onClick={handleClick} />,
      }}
      fullWidth
    />
  );
};
