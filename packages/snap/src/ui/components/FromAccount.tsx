import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Text, Divider } from '@metamask/snaps-sdk/jsx';

export type FromAccountProps = {
  sender: string;
  balance: string;
};

/**
 * Shortens a string.
 * @param str - The string to be shortened.
 * @returns The shortened string.
 */
function shortenString(str: string): string {
  if (str.length <= 10) {
    return str;
  }
  const firstPart = str.slice(0, 5);
  const lastPart = str.slice(-5);
  return `${firstPart}...${lastPart}`;
}

export const FromAccount: SnapComponent<FromAccountProps> = ({
  sender,
  balance,
}: FromAccountProps) => {
  return (
    <Box>
      <Box direction="horizontal" alignment="space-between">
        <Box>
          <Text>icon</Text>
        </Box>
        <Box direction="vertical">
          <Text>Bitcoin Account</Text>
          <Text>{shortenString(sender)}</Text>
        </Box>
        <Box direction="vertical">
          <Text>BTC</Text>
          <Text>{balance}</Text>
        </Box>
      </Box>
      <Divider />
    </Box>
  );
};
