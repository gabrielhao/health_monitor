import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'integration',
    environment: 'jsdom',
    globals: true,
    include: ['src/test/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    },
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})