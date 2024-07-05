import { useState } from 'react';
import styled from 'styled-components';

import {
    Card,
    GetDataForTransactionButton,
  } from '.';
  import {
    useInvokeSnap,
  } from '../hooks';
  
  const InputText = styled.input`
    margin-top: 2.4rem;
    margin-bottom: 2.4rem;
    padding: 1rem;
    border: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

  export const GetTransactionStatusCard = ({
      enabled,
      fullWidth,
      scope,
  }: {
      enabled: boolean;
      fullWidth: boolean;
      scope: string;
  }) => {
    const invokeSnap = useInvokeSnap();
    
    const [transactionId, setTransactionId] = useState('');

    const handleOnChange = (event:any) => {
      setTransactionId(event.target.value);
    }

    const handleClick = async () => {
      const resp = (await invokeSnap({
        method: 'chain_getTransactionStatus',
        params: {
          scope: scope,
          transactionId: transactionId
        },
      }));
      setTransactionId('');
    };
  
    return (
        <Card
            content={{
              title: 'Get Transaction Status',
              description: `Key in the transaction id`,
              button: (
                <>
                <InputText onChange={handleOnChange}>
                </InputText>
                <GetDataForTransactionButton
                  onClick={handleClick}
                  disabled={!enabled || !transactionId}
                />
                </>
              ),
            }}
            disabled={!enabled}
            fullWidth={fullWidth}
          />
    );
  };