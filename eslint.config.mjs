import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import angular from 'angular-eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.angular/**'] },
  {
    files: ['apps/web/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, angular.configs.tsRecommended],
    languageOptions: { globals: globals.browser },
    processor: angular.processInlineTemplates,
  },
  {
    files: ['apps/web/src/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  {
    files: ['apps/web/e2e/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
