import { Button, Footer, type SnapComponent } from '@metamask/snaps-sdk/jsx';

import { getTranslator } from '../../utils/locale';
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
 * @param props - The options object.
 * @param props.disabled - Whether the button is disabled or not.
 * @returns The SendFlowFooter component.
 */
export const SendFlowFooter: SnapComponent<SendFlowFooterProps> = ({
  disabled,
}: SendFlowFooterProps) => {
  const t = getTranslator();

  return (
    <Footer>
      <Button name={SendFormNames.Cancel}>{t('cancel')}</Button>
      <Button name={SendFormNames.Review} disabled={disabled}>
        {t('review')}
      </Button>
    </Footer>
  );
};
