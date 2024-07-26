import { useState } from 'react';
import styled from 'styled-components';

import { Card, EstimateFeeButton } from '.';
import { useInvokeSnap } from '../hooks';

const InputText = styled.input`
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

export const EstimateFeeCard = ({
  enabled,
  fullWidth,
  account,
}: {
  enabled: boolean;
  fullWidth: boolean;
  account: string;
}) => {
  const invokeSnap = useInvokeSnap();

  const [amount, setAmount] = useState('0');

  const handleOnChange = (chgEvent: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(chgEvent.target.value);
  };

  const handleClick = async () => {
    await invokeSnap({
      method: 'estimateFee',
      params: {
        account,
        amount,
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Estimate Fee',
        description: `Estimate Fee`,
        button: (
          <>
            <InputText onChange={handleOnChange}></InputText>
            <EstimateFeeButton onClick={handleClick} disabled={!enabled} />
          </>
        ),
      }}
      disabled={!enabled}
      fullWidth={fullWidth}
    />
  );
};
