import { useState } from 'react';

import { Card, GetBTCAccountBalanceButton } from '.';
import { useInvokeKeyring } from '../hooks';

type Balance = {
  amount: string;
  unit: string;
};

type AssetBalances = {
  [key in string]: Balance;
};

export const GetBalancesCard = ({
  enabled,
  fullWidth,
  scope,
  account,
}: {
  account: string;
  enabled: boolean;
  fullWidth: boolean;
  scope: string;
}) => {
  const invokeSnap = useInvokeKeyring();
  const asset = `${scope}/slip44:0`;
  const [balance, setBalance] = useState('');

  const handleClick = async () => {
    const accountBalance = (await invokeSnap({
      method: 'keyring_getAccountBalances',
      params: {
        id: account,
        assets: [asset],
      },
    })) as AssetBalances;

    setBalance(accountBalance?.[asset]?.amount ?? '0');
  };

  return (
    <Card
      content={{
        title: 'Get Balance of current account',
        description: `Balance ${balance}`,
        button: (
          <>
            <GetBTCAccountBalanceButton
              onClick={handleClick}
              disabled={!enabled}
            />
          </>
        ),
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
