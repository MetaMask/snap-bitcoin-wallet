module.exports = {
  preset: '@metamask/snaps-jest',
  testMatch: ['**/integration/**/*.test.ts'],
  verbose: true,
  runInBand: true,
  detectOpenHandles: true,
  forceExit: true,
};
