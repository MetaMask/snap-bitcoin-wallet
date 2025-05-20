import type { ComponentPropsWithoutRef } from 'react';
import styled from 'styled-components';

import { ReactComponent as FlaskFox } from '../assets/flask_fox.svg';
import { useMetaMask, useRequestSnap } from '../hooks';
import { shouldDisplayReconnectButton } from '../utils';

const Link = styled.a`
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.theme.fontSizes.small};
  border-radius: ${(props) => props.theme.radii.button};
  border: 1px solid ${(props) => props.theme.colors.background?.inverse};
  background-color: ${(props) => props.theme.colors.background?.inverse};
  color: ${(props) => props.theme.colors.text?.inverse};
  text-decoration: none;
  font-weight: bold;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: transparent;
    border: 1px solid ${(props) => props.theme.colors.background?.inverse};
    color: ${(props) => props.theme.colors.text?.default};
  }

  ${({ theme }) => theme.mediaQueries.small} {
    width: 100%;
    box-sizing: border-box;
  }
`;

const Button = styled.button`
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  ${({ theme }) => theme.mediaQueries.small} {
    width: 100%;
  }
`;

const ButtonText = styled.span`
  margin-left: 1rem;
`;

const ConnectedContainer = styled.div`
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

const ConnectedIndicator = styled.div`
  content: ' ';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: green;
`;

export const InstallFlaskButton = () => (
  <Link href="https://metamask.io/flask/" target="_blank">
    <FlaskFox />
    <ButtonText>Install MetaMask Flask</ButtonText>
  </Link>
);

export const ConnectButton = (props: ComponentPropsWithoutRef<'button'>) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>Connect</ButtonText>
    </Button>
  );
};

export const ReconnectButton = (props: ComponentPropsWithoutRef<'button'>) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>Reconnect</ButtonText>
    </Button>
  );
};

export const SendHelloButton = (props: ComponentPropsWithoutRef<'button'>) => {
  return <Button {...props}>Send message</Button>;
};

export const GetBTCAccountBalanceButton = (
  props: ComponentPropsWithoutRef<'button'>,
) => {
  return <Button {...props}>Get BTC Account balance</Button>;
};

export const ListAccountsButton = (
  props: ComponentPropsWithoutRef<'button'>,
) => {
  return <Button {...props}>List Accounts</Button>;
};

export const GetTransactionStatusButton = (
  props: ComponentPropsWithoutRef<'button'>,
) => {
  return <Button {...props}>Get Status</Button>;
};

export const SendBitcoinButton = (
  props: ComponentPropsWithoutRef<'button'>,
) => {
  return <Button {...props}>Send txn</Button>;
};

export const EstimateFeeButton = (
  props: ComponentPropsWithoutRef<'button'>,
) => {
  return <Button {...props}>Estimate Fee</Button>;
};

export const GetMaxSpendableBalanceButton = (
  props: ComponentPropsWithoutRef<'button'>,
) => {
  return <Button {...props}>Get Max Spendable Balance</Button>;
};

export const SellBTCButton = (props: ComponentPropsWithoutRef<'button'>) => {
  return <Button {...props}>Sell your BTC</Button>;
};

export const HeaderButtons = () => {
  const requestSnap = useRequestSnap();
  const { isFlask, installedSnap } = useMetaMask();

  if (!isFlask && !installedSnap) {
    return <InstallFlaskButton />;
  }

  if (!installedSnap) {
    return <ConnectButton onClick={requestSnap} />;
  }

  if (shouldDisplayReconnectButton(installedSnap)) {
    return <ReconnectButton onClick={requestSnap} />;
  }

  return (
    <ConnectedContainer>
      <ConnectedIndicator />
      <ButtonText>Connected</ButtonText>
    </ConnectedContainer>
  );
};
