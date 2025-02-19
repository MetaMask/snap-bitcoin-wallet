module.exports = {
  preset: '@metamask/snaps-jest',
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },
  restoreMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/__mocks__/', '/__tests__/'],
  testMatch: ['**/src/**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleNameMapper: {
    '^.+.(svg)$': 'jest-transform-stub',
  },
};
