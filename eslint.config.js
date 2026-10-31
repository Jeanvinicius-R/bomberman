import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'android/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, __APP_VERSION__: 'readonly' } },
  },
  {
    files: ['*.js', 'scripts/**/*.mjs', 'tests/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
];
