import { useState } from 'react';
import styled from 'styled-components';

import { Card, GetTransactionStatusButton } from '.';
import { useInvokeKeyring, useInvokeSnap } from '../hooks';
import { KeyringRpcMethod } from '@metamask/keyring-api';

const InputText = styled.input`
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

export const SendFlow = ({
  fullWidth,
}: {
  enabled: boolean;
  fullWidth: boolean;
  scope: string;
}) => {
  // const invokeKeyring = useInvokeKeyring();

  // const handleClick = async (scope: string) => {
  //   await invokeKeyring({
  //     method: 'keyring_submitRequest',
  //     params: {
  //       options: {
  //         account: '176d16b9-9eb9-459b-8a2a-707296e0e215',
  //         id: 'a1ac43f7-2d7d-4c56-92a0-c4babe4e66f0',
  //         scope,
  //         request: {
  //           method: 'btc_sendmany',
  //           params: {
  //             amounts: {
  //               bc1q6fresr8vhnx6ut4z4vqatqatj46dg8fyu5tfhm: '0.00000500',
  //             },
  //             comment:
  //               'some very long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long comment',
  //             subtractFeeFrom: [],
  //             replaceable: false,
  //             dryrun: true,
  //           },
  //         },
  //       },
  //       // account: {
  //       //   type: 'bip122:p2wpkh',
  //       //   id: '176d16b9-9eb9-459b-8a2a-707296e0e215',
  //       //   address: 'bc1q6fresr8vhnx6ut4z4vqatqatj46dg8fyu5tfhm',
  //       //   options: {
  //       //     scope: 'bip122:000000000019d6689c085ae165831e93',
  //       //     index: 0,
  //       //   },
  //       //   methods: ['btc_sendmany'],
  //       // },
  //     },
  //   });
  // };

  const invokeKeyring = useInvokeKeyring();

  const handleClick = async (scope: string) => {
    await invokeKeyring({
      method: 'keyring_submitRequest',
      params: {
        account: '176d16b9-9eb9-459b-8a2a-707296e0e215',
        id: '09b44b44-4d87-4bb3-8dbc-03e49521143f',
        scope,
        request: {
          method: 'btc_sendmany',
          params: {
            amounts: {
              bc1q6fresr8vhnx6ut4z4vqatqatj46dg8fyu5tfhm: '0.00000500',
            },
            // comment:
            //   'some very long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long  long long long long long long long long long long long long long long long long long long comment',
            // subtractFeeFrom: [],
            // replaceable: false,
            dryrun: true,
          },
        },
      },
    });
  };

  return (
    <Card
      content={{
        title: 'Send Flow',
        description: `Key in the transaction id`,
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
