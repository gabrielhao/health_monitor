import type { MetricType, HealthMetric } from '@/types'

export function createMockHealthMetric(overrides: Partial<HealthMetric> = {}): HealthMetric {
  return {
    id: 'test-metric-id',
    user_id: 'test-user-id',
    metric_type: 'heart_rate',
    value: 72,
    unit: 'bpm',
    systolic: null,
    diastolic: null,
    notes: null,
    recorded_at: '2024-01-01T10:00:00Z',
    created_at: '2024-01-01T10:00:00Z',
    ...overrides
  }
}

export function createMockBloodPressureMetric(overrides: Partial<HealthMetric> = {}): HealthMetric {
  return createMockHealthMetric({
    metric_type: 'blood_pressure',
    value: null,
    systolic: 120,
    diastolic: 80,
    unit: 'mmHg',
    ...overrides
  })
}

export function generateMetricSeries(
  type: MetricType,
  count: number,
  startDate: Date = new Date('2024-01-01')
): HealthMetric[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
    
    const baseMetric = createMockHealthMetric({
      id: `metric-${i}`,
      metric_type: type,
      recorded_at: date.toISOString(),
      created_at: date.toISOString()
    })

    // Generate realistic values based on metric type
    switch (type) {
      case 'heart_rate':
        return { ...baseMetric, value: 60 + Math.random() * 40, unit: 'bpm' }
      case 'weight':
        return { ...baseMetric, value: 70 + (Math.random() - 0.5) * 10, unit: 'kg' }
      case 'blood_pressure':
        return {
          ...baseMetric,
          value: null,
          systolic: 110 + Math.random() * 30,
          diastolic: 70 + Math.random() * 20,
          unit: 'mmHg'
        }
      case 'steps':
        return { ...baseMetric, value: 5000 + Math.random() * 10000, unit: 'steps' }
      case 'sleep_hours':
        return { ...baseMetric, value: 6 + Math.random() * 4, unit: 'hours' }
      default:
        return baseMetric
    }
  })
}

export function createMockUploadProgress(percentage: number = 0) {
  return {
    percentage,
    uploadedBytes: 0,
    totalBytes: 1024 * 1024, // 1MB
    speed: 1024 * 1024, // 1MB/s
    eta: 0,
    currentChunk: 0,
    totalChunks: 1
  }
}

export function createMockImportSession(overrides: any = {}) {
  return {
    id: 'test-session-id',
    user_id: 'test-user-id',
    source_app: 'apple_health',
    status: 'completed',
    total_records: 100,
    processed_records: 95,
    failed_records: 5,
    error_log: [],
    metadata: {},
    started_at: '2024-01-01T10:00:00Z',
    completed_at: '2024-01-01T10:05:00Z',
    ...overrides
  }
}

export function waitFor(condition: () => boolean, timeout: number = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const check = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'))
      } else {
        setTimeout(check, 10)
      }
    }
    
    check()
  })
}

export function mockConsole() {
  const originalConsole = { ...console }
  
  const mocks = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
  
  Object.assign(console, mocks)
  
  return {
    mocks,
    restore: () => Object.assign(console, originalConsole)
  }
}

export function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0
  
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      const pump = () => {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]))
          index++
          setTimeout(pump, 10) // Simulate async chunks
        } else {
          controller.close()
        }
      }
      
      pump()
    }
  })
}

export function simulateFileUpload(
  onProgress?: (progress: number) => void,
  onChunkComplete?: (chunk: number, total: number) => void,
  totalChunks: number = 4
): Promise<string> {
  return new Promise((resolve) => {
    let currentChunk = 0
    
    const uploadChunk = () => {
      if (currentChunk < totalChunks) {
        const progress = ((currentChunk + 1) / totalChunks) * 100
        onProgress?.(progress)
        onChunkComplete?.(currentChunk, totalChunks)
        currentChunk++
        setTimeout(uploadChunk, 100)
      } else {
        resolve('mock-file-path')
      }
    }
    
    uploadChunk()
  })
}