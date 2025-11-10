import type { Logger } from '../entities';

/**
 * @param fn - The async function to execute
 * @param logger - Logger instance for error reporting
 * @param actionName - Name of the action for logging purposes
 */
export const runSnapActionSafely = async (
  fn: () => Promise<void>,
  logger: Logger,
  actionName: string,
): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    logger.error(`Failed to execute snap action: ${actionName}`, error);
  }
};
