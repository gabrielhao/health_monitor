// Common types used across all services
export interface AuthUser {
  id: string
  email?: string
  name?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// File Upload Service Types
export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
  chunkSize?: number
  maxRetries?: number
  timeout?: number
}

export interface UploadResult {
  path: string
  url: string
  size: number
  id: string
  metadata?: Record<string, any>
}

export interface BatchUploadResult {
  successful: UploadResult[]
  failed: Array<{ filename: string; error: string }>
  totalFiles: number
  successCount: number
  failureCount: number
}

export interface BatchApiResponse {
  success: boolean
  data?: {
    uploads: UploadResult[]
  }
  error?: string
  message?: string
}

export interface ChunkedUploadInitResponse {
  sessionId: string
  totalChunks: number
  chunkSize: number
}

export interface ChunkedUploadStatus {
  sessionId: string
  uploadedChunks: number[]
  totalChunks: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
}

export interface FileMetadata {
  id: string
  url: string
  path: string
  size: number
  type: string
  uploadedAt: string
  metadata?: Record<string, any>
}

export interface UploadRequest {
  userId: string
  metadata?: Record<string, any>
}

export interface ChunkUploadRequest {
  sessionId: string
  chunkIndex: number
  chunk: Buffer
}

// File Processing Service Types
export interface ProcessingJob {
  id: string
  userId: string
  fileName: string
  filePath: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

export interface ProcessingOptions {
  batchSize?: number
  timeout?: number
  retryAttempts?: number
  transformOptions?: Record<string, any>
}

export interface HealthMetric {
  id: string
  userId: string
  user_id?: string
  metricType: string
  value: number | string
  unit?: string
  timestamp: Date
  source: string
  metadata?: Record<string, any>
  _partitionKey: string
}

export interface ProcessingResult {
  jobId: string
  processedRecords: number
  failedRecords: number
  errors: string[]
  metrics: HealthMetric[]
  processingTime: number
}

export interface FileProcessingRequest {
  userId: string
  fileName?: string // defaults to "import_data.xml"
  options?: ProcessingOptions
}

// Service Configuration Types
export interface ServiceConfig {
  name: string
  version: string
  port: number
  environment: string
  cors: {
    allowedOrigins: string[]
  }
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
}

export interface AzureConfig {
  storage: {
    connectionString: string
    containerName: string
  }
  cosmos: {
    endpoint: string
    key: string
    database: string
    containers: {
      healthMetrics: string
    }
  }
}

// RAG Documents Types
export interface RAGDocument {
  id: string
  userId: string
  documentId: string
  documentFilePath: string
  isProcessed: boolean
  uploadDate: Date
  originalFileName?: string
  fileSize?: number
  contentType?: string
  metadata?: Record<string, any>
  _partitionKey: string
} 