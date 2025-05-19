import base, { createConfig } from '@metamask/eslint-config';
import typescript from '@metamask/eslint-config-typescript';
import jest from '@metamask/eslint-config-jest';
import browser from '@metamask/eslint-config-browser';

export default createConfig([
  {
    ignores: [
      'packages/snap/dist/',
      'packages/site/.cache/',
      'packages/site/public/',
    ],
  },
  {
    files: ['packages/snap/**/*.{ts,tsx}'],
    extends: [base, typescript],
    rules: {
      'id-length': ['warn', { exceptions: ['t'] }] // Used for the localized translator helper.
    },
  },
  {
    files: ['packages/site/**/*.{ts,tsx}'],
    extends: [base, typescript, browser],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off' // this rule should be removed eventually for non tests files
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    extends: [base, typescript, jest],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    },
  },
  {
    files: ['**/snap.config.ts'],
    rules: {
      'import-x/no-nodejs-modules': 'off',
      'no-restricted-globals': 'off',
    },
  }
]);
