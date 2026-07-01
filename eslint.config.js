// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Ignore build output, dependencies, and generated/vendored assets.
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'public/**',
    ],
  },

  // Base JS recommended rules for every linted file.
  js.configs.recommended,

  // TypeScript recommended (non type-checked to keep CI fast and avoid
  // requiring a full type-check just to lint).
  ...tseslint.configs.recommended,

  // Astro components.
  ...astro.configs.recommended,

  // Node/browser globals for the various runtimes in this project.
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,astro}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  // Project-specific tuning. The recommended rulesets surface a fair amount
  // of pre-existing code smell in this repo. To land linting without a
  // large, unrelated code cleanup in the same PR, the noisiest of these are
  // set to `warn` so CI stays green while the issues remain visible. Tighten
  // them to `error` (and fix the underlying code) in follow-up cleanups.
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,astro}'],
    rules: {
      'no-empty': 'warn',
      'no-useless-assignment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Turn off formatting-related rules that conflict with Prettier.
  eslintConfigPrettier,
);
