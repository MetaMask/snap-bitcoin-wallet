module.exports = {
  extends: ['../../.eslintrc.js'],
  rules: {
    // This allows importing the `Text` JSX component.
    '@typescript-eslint/no-shadow': [
      'error',
      {
        allow: ['Text'],
      },
    ],
    'id-length': [
      'warn',
      // Used for the localized translator helper.
      { exceptions: ['t'] },
    ],
  },

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['snap.config.ts'],
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['*.test.ts'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
      },
    },

    {
      files: ['*.ts'],
      rules: {
        'import/no-nodejs-modules': 'off',
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', 'dist/'],
};
