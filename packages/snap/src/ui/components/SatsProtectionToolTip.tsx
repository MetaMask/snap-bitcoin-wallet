import {
  Icon,
  Text,
  Tooltip,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

export const SatsProtectionToolTip: SnapComponent = () => {
  return (
    <Tooltip
      content={
        <Text>
          MetaMask is protecting your Ordinials, Rare SATs, and Runes to be send
          in Bitcoin Transactions.
        </Text>
      }
    >
      <Icon name="question" size="md" />
    </Tooltip>
  );
};
