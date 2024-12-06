import {
  Icon,
  Text,
  Tooltip,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { getTranslator } from '../../utils/locale';

/**
 * A component that shows a tooltip for SATs protection.
 *
 * @returns The SatsProtectionToolTip component.
 */
export const SatsProtectionToolTip: SnapComponent = () => {
  const t = getTranslator();

  return (
    <Tooltip content={<Text>{t('satProtectionTooltip')}</Text>}>
      <Icon name="question" size="md" />
    </Tooltip>
  );
};
