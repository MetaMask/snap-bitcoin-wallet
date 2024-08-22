import type { SendFlowProps } from '../SendFlow';
import { SendFlow } from '../SendFlow';

/**
 * Generate the send flow form component.
 *
 * @param sendFlowProps - The send flow props.
 * @returns The send flow form component to display.
 */
export function generateSendFlowComponent(
  sendFlowProps: SendFlowProps,
): JSX.Element {
  return <SendFlow {...sendFlowProps} />;
}
