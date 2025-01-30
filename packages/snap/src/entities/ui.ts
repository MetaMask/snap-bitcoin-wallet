import { ComponentOrElement } from '@metamask/snaps-sdk';
import { Json } from '@metamask/utils';

export type UserInterface = {
  /**
   * The id of the UI.
   */
  id: string;

  /**
   * Gets the UI component.
   * @returns the UI component
   */
  component(): ComponentOrElement;

  /**
   * Gets the UI context.
   * @returns the UI context
   */
  context(): Record<string, Json>;
};

export type UIComponent = {};
