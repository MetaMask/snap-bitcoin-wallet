import {
  Icon,
  Text,
  Tooltip,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

/**
 * A component that shows a tooltip for SATs protection.
 *
 * @returns The SatsProtectionToolTip component.
 */
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
