import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { mockSupabaseClient } from './mocks/supabase'

// Mock Supabase
vi.mock('@/services/supabase', () => ({
  supabase: mockSupabaseClient
}))

// Mock ChunkUploadService
vi.mock('@/services/chunkUploadService', () => ({
  chunkUploadService: {
    uploadFile: vi.fn()
  }
}))

// Mock useFileUpload composable
vi.mock('@/composables/useFileUpload', () => ({
  useFileUpload: () => ({
    uploading: { value: false },
    progress: { 
      value: {
        percentage: 0,
        uploadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        currentChunk: 0,
        totalChunks: 0
      }
    },
    error: { value: '' },
    formattedSpeed: { value: '0 B/s' },
    formattedETA: { value: '--' },
    uploadFile: vi.fn(),
    cancelUpload: vi.fn(),
    resetProgress: vi.fn()
  })
}))

// Mock crypto.subtle for MD5 calculations
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(16))
    }
  }
})

// Mock DOMParser for XML parsing
global.DOMParser = class MockDOMParser {
  parseFromString(str: string, type: string) {
    return {
      getElementsByTagName: vi.fn(() => []),
      documentElement: {
        children: [],
        attributes: []
      }
    }
  }
}

// Mock FileReader
global.FileReader = class MockFileReader {
  onload: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  
  readAsText(file: Blob) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: 'mock file content' } })
      }
    }, 0)
  }
}

// Global test configuration
config.global.stubs = {
  teleport: true
}