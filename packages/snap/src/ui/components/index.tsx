import { SendFlowConfirmation } from './SendFlowConfirmation';
import type { SendFlowProps } from './SendFlowInput';
import { SendFlowInput } from './SendFlowInput';

/**
 * Generate the send flow form component.
 *
 * @param sendFlowProps - The send flow props.
 * @returns The send flow form component to display.
 */
export function generateSendFlowComponent(
  sendFlowProps: SendFlowProps,
): JSX.Element {
  return sendFlowProps.step === 'review' ? (
    <SendFlowInput {...sendFlowProps} />
  ) : (
    <SendFlowConfirmation {...sendFlowProps} />
  );
}
