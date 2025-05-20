// @ts-check
/**
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
const config = {
  preset: '@metamask/snaps-jest',
  testMatch: ['**/integration-test/**/*.test.ts'],
};

export default config;

