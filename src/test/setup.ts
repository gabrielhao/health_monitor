import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock Supabase
vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn()
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn()
      }))
    },
    functions: {
      invoke: vi.fn()
    }
  }
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