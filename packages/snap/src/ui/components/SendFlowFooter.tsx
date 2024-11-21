import { Button, Footer, type SnapComponent } from '@metamask/snaps-sdk/jsx';

import type { Locale } from '../../utils/locale';
import { SendFormNames } from './SendForm';

/**
 * The props for the {@link SendFlowFooter} component.
 *
 * @property disabled - Whether the button is disabled or not.
 */
export type SendFlowFooterProps = {
  locale: Locale;
  disabled: boolean;
};

/**
 * A component that shows the send flow footer.
 *
 * @param props - The options object.
 * @param props.locale - The locale of the user.
 * @param props.disabled - Whether the button is disabled or not.
 * @returns The SendFlowFooter component.
 */
export const SendFlowFooter: SnapComponent<SendFlowFooterProps> = ({
  locale,
  disabled,
}: SendFlowFooterProps) => (
  <Footer>
    <Button name={SendFormNames.Cancel}>{locale.cancel.message}</Button>
    <Button name={SendFormNames.Review} disabled={disabled}>
      {locale.review.message}
    </Button>
  </Footer>
);
