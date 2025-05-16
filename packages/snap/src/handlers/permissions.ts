export const validateOrigin = (origin: string): void => {
  if (origin !== 'metamask') {
    throw new Error('Permission denied');
  }
};
