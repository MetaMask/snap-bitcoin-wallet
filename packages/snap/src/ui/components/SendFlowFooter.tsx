import { Button, Footer, type SnapComponent } from '@metamask/snaps-sdk/jsx';

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
 * @returns The SendFlowFooter component.
 */
export const SendFlowFooter: SnapComponent<SendFlowFooterProps> = ({
  disabled,
}: SendFlowFooterProps) => (
  <Footer>
    <Button name="review" disabled={disabled}>
      Review
    </Button>
  </Footer>
);
