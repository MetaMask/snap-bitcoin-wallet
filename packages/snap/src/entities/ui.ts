import type { ComponentOrElement } from '@metamask/snaps-sdk';
import type { Json } from '@metamask/utils';

export type UserInterface = {
  /**
   * Gets the UI component.
   * @returns the UI component
   */
  component(): ComponentOrElement;

  /**
   * Gets the UI context.
   * @returns the UI context
   */
  context: UIContext;
};

export type UIContext = Record<string, Json>;
