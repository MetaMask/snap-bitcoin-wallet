import type { KeyringAccount } from '@metamask/keyring-api';
import { useState } from 'react';
import styled from 'styled-components';

import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  CreateBTCAccountButton,
  ListAccountsButton,
  SendManyCard,
  GetTransactionStatusCard,
} from '../components';
import { defaultSnapOrigin } from '../config';
import {
  useMetaMask,
  useInvokeSnap,
  useInvokeKeyring,
  useMetaMaskContext,
  useRequestSnap,
} from '../hooks';
import { isLocalSnap, shouldDisplayReconnectButton } from '../utils';


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

const Resp = styled.div`
  background-color: ${({ theme }) => theme.colors.primary?.muted};
  border: 1px solid ${({ theme }) => theme.colors.primary?.default};
  color: ${({ theme }) => theme.colors.primary?.alternative};
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

const Title = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.large};
  margin: 0;
  margin-bottom: 1.2rem;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
`;

const Loading = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(16, 16, 16, 0.5);
  z-index: 1000;
`
const LoadingText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1001;
  font-size: 5rem;
`

const Index = () => {
  const { error, resp, loading } = useMetaMaskContext();
  const { isFlask, snapsDetected, installedSnap } = useMetaMask();
  const requestSnap = useRequestSnap();
  const invokeSnap = useInvokeSnap();
  const invokeKeyring = useInvokeKeyring();
  const [btcAccount, setBtcAccount] = useState<KeyringAccount>();
  const scope = 'bip122:000000000933ea01ad0ee984209779ba'

  const isMetaMaskReady = isLocalSnap(defaultSnapOrigin)
    ? isFlask
    : snapsDetected;

  const handleCreateAccountClick = async () => {
    const account = (await invokeSnap({
      method: 'chain_createAccount',
      params: {
        scope: scope,
      },
    })) as KeyringAccount;

    console.log({
      account,
    });

    setBtcAccount(account);
  };

  const handleListAccountClick = async () => {
    const accounts = (await invokeKeyring({
      method: 'keyring_listAccounts',
    })) as KeyringAccount[];

    if (accounts.length) {
      const account = accounts.find((account) => account.options.scope === scope)
      setBtcAccount(account);
    }
  };
  
  return (
    <Container>
      <Heading>
        <Span>BTC Snap</Span>
      </Heading>
      <CardContainer>
        
        {
          loading && (
            <Loading>
              <LoadingText>LOADING...</LoadingText>
            </Loading>
          )
        }
   
        {error && (
          <ErrorMessage>
            <b>An error happened:</b> {error.message}
          </ErrorMessage>
        )}
        {
          resp && (
            <Resp>
              <Title>RPC Response</Title>
              {resp}
            </Resp>
          )
        }
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
            title: 'List Account',
            description: `List BTC Account from Snap state`,
            button: (
              <ListAccountsButton
                onClick={handleListAccountClick}
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
        {/* <GetBalancesCard 
          enabled={!(!installedSnap || !btcAccount)}
          account={btcAccount?.id || ''}
          scope={scope}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        /> */}

        {/* <GetDataForTransactionCard
          account={btcAccount?.address || ''}
          scope={scope}
          enabled={!(!installedSnap || !btcAccount)}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        />

        <EstimateFeesCard
          scope={scope}
          enabled={!(!installedSnap || !btcAccount)}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        />

        <BroadcastTxnCard
          enabled={!(!installedSnap || !btcAccount)}
          scope={scope}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        /> */}

        <SendManyCard 
          enabled={!(!installedSnap || !btcAccount)}
          account={btcAccount?.id || ''}
          address={btcAccount?.address || ''}
          scope={scope}
          fullWidth={
            isMetaMaskReady &&
            Boolean(installedSnap) &&
            !shouldDisplayReconnectButton(installedSnap)
          }
        />

        <GetTransactionStatusCard
          enabled={!(!installedSnap || !btcAccount)}
          scope={scope}
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
