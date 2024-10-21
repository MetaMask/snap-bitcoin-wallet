import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Button, Heading, Icon, Text } from '@metamask/snaps-sdk/jsx';

import { SendFormNames } from './SendForm';

/**
 * The props for the {@link SendFlowHeader} component.
 *
 * @property heading - The heading to display.
 */
export type SendFlowHeaderProps = {
  heading: string;
};

/**
 * A component that shows the send flow header.
 *
 * @param props - The component props.
 * @param props.heading - The heading to display.
 * @returns The SendFlowHeader component.
 */
export const SendFlowHeader: SnapComponent<SendFlowHeaderProps> = ({
  heading,
}) => (
  <Box direction="horizontal" alignment="space-between" center>
    <Button name={SendFormNames.HeaderBack}>
      <Icon name="arrow-left" color="primary" size="md" />
    </Button>
    <Heading size="sm">{heading}</Heading>
    <Text> </Text>
  </Box>
);
