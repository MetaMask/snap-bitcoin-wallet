import { PermissionError } from '../entities';

export const METAMASK_ORIGIN = 'metamask';

export const validateOrigin = (origin: string): void => {
  if (origin !== METAMASK_ORIGIN) {
    throw new PermissionError('Invalid origin', { origin });
  }
};
