import { vi } from 'vitest'

export const mockSupabaseClient = {
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

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockProfile = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  privacy_settings: {
    data_sharing: false,
    analytics: true,
    notifications: true
  },
  medical_conditions: [],
  medications: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockFile = (overrides = {}) => {
  const defaultFile = {
    name: 'test-file.xml',
    size: 1024 * 1024, // 1MB
    type: 'text/xml',
    lastModified: Date.now(),
    slice: vi.fn((start, end) => new Blob(['mock chunk'], { type: 'text/xml' })),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    text: vi.fn().mockResolvedValue('mock file content'),
    ...overrides
  }
  
  return defaultFile as File
}