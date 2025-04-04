import { UnauthorizedError } from '@metamask/snaps-sdk';

export const validateOrigin = (origin: string) => {
  if (origin !== 'metamask') {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new UnauthorizedError('Permission denied');
  }
};
