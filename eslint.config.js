import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

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
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        // Test globals
        vi: 'readonly',
        // Deno globals
        Deno: 'readonly',
        // Vue globals
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly'
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
      'prettier/prettier': 'error',
      // Disable no-undef as we're using globals
      'no-undef': 'off',
      // Allow console in development
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      // TypeScript specific rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }]
    }
  },
  // Special configuration for test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'src/test/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  // Special configuration for Deno files
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  }
]; 