module.exports = {
  preset: '@metamask/snaps-jest',
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  restoreMocks: true,
  resetMocks: true,
  verbose: true,
  testMatch: ['**/src/**/?(*.)+(spec|test).[tj]s?(x)'],
};
