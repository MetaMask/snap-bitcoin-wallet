import { useState } from 'react';
import styled from 'styled-components';

import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  Button,
} from '../components';
import { defaultSnapOrigin } from '../config';
import {
  useMetaMask,
  useMetaMaskContext,
  useRequestSnap,
  useInvokeSnap,
} from '../hooks';
import {
  AddressType,
  isLocalSnap,
  Network,
  shouldDisplayReconnectButton,
} from '../utils';

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
`;
const LoadingText = styled.div`
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999999;
  font-size: 5rem;
`;

const Dropdown = styled.select`
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.theme.fontSizes.small};
  border-radius: ${(props) => props.theme.radii.button};
  border: 1px solid ${(props) => props.theme.colors.background?.inverse};
  background-color: ${(props) => props.theme.colors.background?.inverse};
  color: ${(props) => props.theme.colors.text?.inverse};
  font-weight: bold;
  padding: 1.2rem;
`;

const InputText = styled.input`
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

const networkToProvider = {
  [Network.Bitcoin]: 'https://blockstream.info/api',
  [Network.Testnet]: 'https://blockstream.info/testnet/api',
  [Network.Testnet4]: 'https://mempool.space/testnet4/api/v1',
  [Network.Signet]: 'https://mutinynet.com/api',
  [Network.Regtest]: 'https://localhost:3000',
};

const Index = () => {
  const { error, resp, loading } = useMetaMaskContext();
  const { isFlask, snapsDetected, installedSnap } = useMetaMask();
  const requestSnap = useRequestSnap();
  const invokeSnap = useInvokeSnap();

  const [network, setNetwork] = useState(Network.Testnet);
  const [provider, setProvider] = useState(networkToProvider[network]);
  const [addressType, setAddressType] = useState(AddressType.P2wpkh);
  const [isSynced, setIsSynced] = useState(false);
  const [peekIndex, setPeekIndex] = useState(0);

  const isMetaMaskReady = isLocalSnap(defaultSnapOrigin)
    ? isFlask
    : snapsDetected;

  const isSnapReady =
    isMetaMaskReady &&
    Boolean(installedSnap) &&
    !shouldDisplayReconnectButton(installedSnap);

  const handleCreateWallet = async () => {
    const provider = networkToProvider[network];

    await invokeSnap({
      method: 'createWallet',
      params: {
        network,
        addressType,
        provider,
      },
    });

    setProvider(provider);
    setIsSynced(true);
  };

  const handleCreateWalletPersist = async () => {
    await invokeSnap({
      method: 'createWalletPersist',
      params: {
        network,
        addressType,
      },
    });

    setIsSynced(true);
  };

  const handleLoadWallet = async () => {
    const network = (await invokeSnap({
      method: 'loadWallet',
      params: {
        provider,
      },
    })) as Network;

    setProvider(networkToProvider[network]);
    setIsSynced(true);
  };

  const handleGetState = async () => {
    await invokeSnap({
      method: 'getState',
      params: {},
    });
  };

  const handleSync = async () => {
    await invokeSnap({
      method: 'sync',
      params: {
        provider: networkToProvider[network],
      },
    });
  };

  const handleGetBalance = async () => {
    await invokeSnap({
      method: 'getBalance',
      params: {
        provider: networkToProvider[network],
      },
    });
  };

  const handleGetNextUnusedAddress = async () => {
    await invokeSnap({
      method: 'getNextUnusedAddress',
      params: {
        provider: networkToProvider[network],
      },
    });
  };

  const handleRevealNextAddress = async () => {
    await invokeSnap({
      method: 'revealNextAddress',
      params: {
        provider: networkToProvider[network],
      },
    });
  };

  const handlePeekAddress = async () => {
    await invokeSnap({
      method: 'peekAddress',
      params: {
        provider: networkToProvider[network],
        index: peekIndex,
      },
    });
  };

  const handlePeekOnChange = (
    chgEvent: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setPeekIndex(chgEvent.target.value as unknown as number);
  };

  const handleListUnusedAddresses = async () => {
    await invokeSnap({
      method: 'listUnusedAddresses',
      params: {
        provider: networkToProvider[network],
      },
    });
  };

  const handleListUnspentOutputs = async () => {
    await invokeSnap({
      method: 'listUnspentOutputs',
      params: {
        provider: networkToProvider[network],
      },
    });
  };

  const networkOnChange = (chgEvent: React.ChangeEvent<HTMLSelectElement>) => {
    const network = chgEvent.target.value as unknown as Network;
    setNetwork(network);
    setProvider(networkToProvider[network]);
  };

  const addressTypeOnChange = (
    chgEvent: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setAddressType(chgEvent.target.value as unknown as AddressType);
  };

  return (
    <Container>
      <Heading>
        <Span>BTC Snap</Span>
      </Heading>
      <CardContainer>
        {loading && (
          <Loading>
            <LoadingText>LOADING...</LoadingText>
          </Loading>
        )}

        {error && (
          <ErrorMessage>
            <b>An error happened:</b> {error.message}
          </ErrorMessage>
        )}
        {resp && (
          <Resp>
            <Title>RPC Response</Title>
            {resp}
          </Resp>
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
            title: 'Provider',
            description: provider,
          }}
          disabled={!installedSnap}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Create Wallet',
            description:
              'New wallet will be created and full scanned with the provider. Will replace any existing wallet.',
            button: (
              <>
                <Dropdown onChange={addressTypeOnChange} value={addressType}>
                  <option value={AddressType.P2pkh}>Legacy</option>
                  <option value={AddressType.P2sh}>Segwit</option>
                  <option value={AddressType.P2wpkh}>Native Segwit</option>
                  <option value={AddressType.P2tr}>Taproot</option>
                </Dropdown>

                <br />

                <Dropdown onChange={networkOnChange} value={network}>
                  <option value={Network.Bitcoin}>Bitcoin</option>
                  <option value={Network.Testnet}>Testnet</option>
                  <option value={Network.Testnet4}>Testnet4</option>
                  <option value={Network.Signet}>Signet</option>
                  <option value={Network.Regtest}>Regtest</option>
                </Dropdown>

                <br />

                <Button onClick={handleCreateWallet}>Create Wallet</Button>
              </>
            ),
          }}
          disabled={!installedSnap}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Create Wallet Persist',
            description: 'New wallet with auto persistence (no full-scan)',
            button: (
              <>
                <Dropdown onChange={addressTypeOnChange} value={addressType}>
                  <option value={AddressType.P2pkh}>Legacy</option>
                  <option value={AddressType.P2sh}>Segwit</option>
                  <option value={AddressType.P2wpkh}>Native Segwit</option>
                  <option value={AddressType.P2tr}>Taproot</option>
                </Dropdown>

                <br />

                <Dropdown onChange={networkOnChange} value={network}>
                  <option value={Network.Bitcoin}>Bitcoin</option>
                  <option value={Network.Testnet}>Testnet</option>
                  <option value={Network.Testnet4}>Testnet4</option>
                  <option value={Network.Signet}>Signet</option>
                  <option value={Network.Regtest}>Regtest</option>
                </Dropdown>

                <br />

                <Button onClick={handleCreateWalletPersist}>
                  Create Wallet
                </Button>
              </>
            ),
          }}
          disabled={!installedSnap}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Load Wallet',
            description:
              'Get Wallet from the state or errors if it does not exist',
            button: <Button onClick={handleLoadWallet}>Load Wallet</Button>,
          }}
          disabled={isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Display State',
            description: `Get the current state data`,
            button: <Button onClick={handleGetState}>Get State</Button>,
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Sync',
            description: `Sync state with the provider`,
            button: <Button onClick={handleSync}>Sync State</Button>,
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Get Balance',
            description: `Get the current balance`,
            button: <Button onClick={handleGetBalance}>Get Balance</Button>,
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Get Next Unused Address',
            description: 'Address is already revealed',
            button: (
              <Button onClick={handleGetNextUnusedAddress}>Get Address</Button>
            ),
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Reveal Next Address',
            description: 'New address will be revealed',
            button: (
              <Button onClick={handleRevealNextAddress}>Get Address</Button>
            ),
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'Peek Address',
            description: 'Address will NOT be revealed',
            button: (
              <>
                <InputText onChange={handlePeekOnChange}></InputText>
                <Button onClick={handlePeekAddress}>Get Address</Button>
              </>
            ),
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'List Unused Addresses',
            description: 'All current revealed unused addresses',
            button: (
              <Button onClick={handleListUnusedAddresses}>
                List Addresses
              </Button>
            ),
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />

        <Card
          content={{
            title: 'List Unspent Outputs',
            description: 'All current unspent outputs',
            button: (
              <Button onClick={handleListUnspentOutputs}>List UTXOs</Button>
            ),
          }}
          disabled={!isSynced}
          fullWidth={isSnapReady}
        />
      </CardContainer>
    </Container>
  );
};

export default Index;
