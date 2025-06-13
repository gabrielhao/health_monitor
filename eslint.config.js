import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import vue from 'eslint-plugin-vue';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.git/**',
      'public/**'
    ],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'prettier': prettier,
      'vue': vue
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...vue.configs.base.rules,
      ...vue.configs.essential.rules,
      'prettier/prettier': 'error'
    }
  }
]; 