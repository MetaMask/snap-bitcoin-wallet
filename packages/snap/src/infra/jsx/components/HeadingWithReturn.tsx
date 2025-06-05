import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Button, Heading, Icon, Image } from '@metamask/snaps-sdk/jsx';

export type HeadingWithReturnProps = {
  heading: string;
  returnButtonName: string;
};

export const HeadingWithReturn: SnapComponent<HeadingWithReturnProps> = ({
  heading,
  returnButtonName,
}) => (
  <Box direction="horizontal" alignment="space-between" center>
    <Button name={returnButtonName}>
      <Icon name="arrow-left" color="primary" size="md" />
    </Button>
    <Heading size="sm">{heading}</Heading>
    {/* FIXME: This empty space is needed to center-align the header text.
     * The Snap UI centers the text within its container, but the container
     * itself is misaligned in the header due to the back arrow.
     */}
    <Box direction="horizontal">
      <Box>{null}</Box>
      <Box>{null}</Box>
      <Box>{null}</Box>
      <Box>{null}</Box>
    </Box>
  </Box>
);
