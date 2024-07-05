import { useState } from 'react';
import styled from 'styled-components';

import { Card, BroadcastTxnButton } from '.';
import { useInvokeSnap } from '../hooks';

const InputText = styled.input`
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

export const BroadcastTxnCard = ({
  enabled,
  fullWidth,
  scope,
}: {
  enabled: boolean;
  fullWidth: boolean;
  scope: string;
}) => {
  const invokeSnap = useInvokeSnap();

  const [signedTransaction, setSignedTransaction] = useState('');

  const handleOnChange = (action: any) => {
    setSignedTransaction(action.target.value);
  };

  const handleClick = async () => {
    const resp = await invokeSnap({
      method: 'chain_broadcastTransaction',
      params: {
        scope,
        signedTransaction,
      },
    });
    console.log({
      resp,
    });
    setSignedTransaction('');
  };

  return (
    <Card
      content={{
        title: 'Broadcast txn',
        description: `Key in the signed transaction`,
        button: (
          <>
            <InputText onChange={handleOnChange}></InputText>
            <BroadcastTxnButton
              onClick={handleClick}
              disabled={!enabled || !signedTransaction}
            />
          </>
        ),
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
