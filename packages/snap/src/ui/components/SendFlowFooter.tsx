import { Button, Footer, type SnapComponent } from '@metamask/snaps-sdk/jsx';

import { SendFormNames } from './SendForm';

/**
 * The props for the {@link SendFlowFooter} component.
 *
 * @property disabled - Whether the button is disabled or not.
 */
export type SendFlowFooterProps = {
  disabled: boolean;
};

/**
 * A component that shows the send flow footer.
 *
 * @param options0 - The options object.
 * @param options0.disabled - Whether the button is disabled or not.
 * @returns The SendFlowFooter component.
 */
export const SendFlowFooter: SnapComponent<SendFlowFooterProps> = ({
  disabled,
}: SendFlowFooterProps) => (
  <Footer>
    <Button name={SendFormNames.Cancel}>Cancel</Button>
    <Button name={SendFormNames.Review} disabled={disabled}>
      Review
    </Button>
  </Footer>
);
