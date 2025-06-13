import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/main.ts',
        'src/vite-env.d.ts',
        'src/assets/**',
        'public/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Critical file thresholds
        'src/services/chunkUploadService.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        'src/composables/useFileUpload.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        'src/stores/auth.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        'src/stores/health.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        }
      },
      all: true,
      skipFull: false,
      clean: true,
      cleanOnRerun: true
    },
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})