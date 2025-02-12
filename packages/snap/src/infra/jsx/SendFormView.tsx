import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Container, Text } from '@metamask/snaps-sdk/jsx';

import type { SendFormContext } from '../../entities';

// Empty for now just to separate the work in smaller PRs
export const SendFormView: SnapComponent<SendFormContext> = () => {
  return (
    <Container>
      <Text>Empty placeholder</Text>
    </Container>
  );
};
