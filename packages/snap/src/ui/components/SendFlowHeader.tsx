import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Button, Heading, Icon } from '@metamask/snaps-sdk/jsx';

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
    <Button name="back">
      <Icon name="arrow-left" color="primary" size="md" />
    </Button>
    <Heading>{heading}</Heading>
    <Button name="menu">
      <Icon name="more-vertical" color="primary" size="md" />
    </Button>
  </Box>
);
