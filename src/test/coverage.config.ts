export const coverageConfig = {
  // Minimum coverage thresholds
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Per-file thresholds for critical components
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
    },
    'src/pages/DataImportPage.vue': {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    },
    'src/components/shared/FileUploadProgress.vue': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    }
  },
  
  // Files to exclude from coverage
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
  
  // Coverage reporters
  reporter: ['text', 'json', 'html', 'lcov'],
  
  // Output directory
  reportsDirectory: './coverage',
  
  // Additional configuration
  all: true,
  skipFull: false,
  clean: true,
  cleanOnRerun: true
}