import { PermissionError } from '../entities';

export const validateOrigin = (origin: string): void => {
  if (origin !== 'metamask') {
    throw new PermissionError('Invalid origin', { origin });
  }
};
