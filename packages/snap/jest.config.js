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
  collectCoverage: true,
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    './src/**/*.ts',
    '!./src/**/*.d.ts',
    '!./src/**/index.ts',
    '!./src/modules/config/config.ts',
    '!./src/modules/config/permissions.ts',
    '!./src/**/type?(s).ts',
    '!./src/**/exception?(s).ts',
    '!./test/**',
    './src/index.ts',
  ],
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'babel',

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ['html', 'json-summary', 'text'],
};
