import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      'extensions/chrome/dist/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}', 'extensions/chrome/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: ['extensions/chrome/**/*.ts'],
    languageOptions: {
      globals: {
        chrome: 'readonly',
      },
    },
  },

  eslintConfigPrettier,
);
