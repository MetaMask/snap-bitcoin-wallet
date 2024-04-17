import type { KeyringAccount } from '@metamask/keyring-api';
import { KeyringSnapRpcClient } from '@metamask/keyring-api';
import { useState } from 'react';
import styled from 'styled-components';

import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  CreateBTCAccountButton,
  GetBTCAccountBalanceButton,
} from '../components';
import { defaultSnapOrigin } from '../config';
import { defaultSnapOrigin as snapId } from '../config/snap';
import {
  useMetaMask,
  useInvokeSnap,
  useMetaMaskContext,
  useRequestSnap,
} from '../hooks';
import { isLocalSnap, shouldDisplayReconnectButton } from '../utils';

export const keyringClient = new KeyringSnapRpcClient(snapId, window.ethereum);

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 7.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const Heading = styled.h1`
  margin-top: 0;
  margin-bottom: 2.4rem;
  text-align: center;
`;

const Span = styled.span`
  color: ${(props) => props.theme.colors.primary?.default};
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 64.8rem;
  width: 100%;
  height: 100%;
  margin-top: 1.5rem;
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error?.muted};
  border: 1px solid ${({ theme }) => theme.colors.error?.default};
  color: ${({ theme }) => theme.colors.error?.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const Index = () => {
  const { error } = useMetaMaskContext();
  const { isFlask, snapsDetected, installedSnap } = useMetaMask();
  const requestSnap = useRequestSnap();
  const invokeSnap = useInvokeSnap();
  const [btcAccount, setBtcAccount] = useState<KeyringAccount>();
  const [balance, setBalance] = useState<number>(0);

  const isMetaMaskReady = isLocalSnap(defaultSnapOrigin)
    ? isFlask
    : snapsDetected;

  const handleCreateAccountClick = async () => {
    const account = (await invokeSnap({
      method: 'bitcoin_createAccount',
      params: {
        index: 0,
        scope:
          '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943',
      },
    })) as KeyringAccount;
    setBtcAccount(account);
  };

  const handleGetBalanceClick = async () => {
    const accountBalance = (await invokeSnap({
      method: 'bitcoin_getBalance',
      params: {
        address: btcAccount?.address,
        scope:
          '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943',
      },
    })) as { confirmed: number; unconfirmed: number; total: number };
    setBalance(accountBalance.total);
  };

  return (
    <Container>
      <Heading>
        <Span>BTC Snap</Span>
      </Heading>
      <CardContainer>
        {error && (
          <ErrorMessage>
            <b>An error happened:</b> {error.message}
          </ErrorMessage>
        )}
        {!isMetaMaskReady && (
          <Card
            content={{
              title: 'Install',
              description:
                'Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.',
              button: <InstallFlaskButton />,
            }}
            fullWidth
          />
        )}
        {!installedSnap && (
          <Card
            content={{
              title: 'Connect',
              description:
                'Get started by connecting to and installing the example snap.',
              button: (
                <ConnectButton
                  onClick={requestSnap}
                  disabled={!isMetaMaskReady}
                />
              ),
            }}
            disabled={!isMetaMaskReady}
          />
        )}
        {shouldDisplayReconnectButton(installedSnap) && (
          <Card
            content={{
              title: 'Reconnect',
              description:
                'While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.',
              button: (
                <ReconnectButton
                  onClick={requestSnap}
                  disabled={!installedSnap}
                />
              ),
            }}
            disabled={!installedSnap}
          />
        )}
        <Card
          content={{
            title: 'Create Account',
            description: `Create BTC Account - ${btcAccount?.address}`,
            button: (
              <CreateBTCAccountButton
                onClick={handleCreateAccountClick}
                disabled={!installedSnap}
              />
            ),
          }}
          disabled={!installedSnap}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        />
        <Card
          content={{
            title: 'Get Balance',
            description: `Get BTC Account's balance - ${balance}`,
            button: (
              <GetBTCAccountBalanceButton
                onClick={handleGetBalanceClick}
                disabled={!installedSnap}
              />
            ),
          }}
          disabled={!installedSnap || !btcAccount}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        />
      </CardContainer>
    </Container>
  );
};

export default Index;
