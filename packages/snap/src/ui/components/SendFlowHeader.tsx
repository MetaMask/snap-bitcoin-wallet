import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Button, Heading, Icon, Image } from '@metamask/snaps-sdk/jsx';

import emptySpace from '../images/empty-space.svg';
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
}) => {
  console.log('heading', heading);
  return (
    <Box direction="horizontal" alignment="space-between" center>
      <Button name={SendFormNames.HeaderBack}>
        <Icon name="arrow-left" color="primary" size="md" />
      </Button>
      <Heading size="sm">{heading}</Heading>
      {/* FIXME: This empty space is needed to center-align the header text.
       * The Snap UI centers the text within its container, but the container
       * itself is misaligned in the header due to the back arrow.
       */}
      <Image src={emptySpace} />
    </Box>
  );
};
