import type { UploadProgress } from '@/composables/useFileUpload'
import type { 
  UploadResult, 
  BatchUploadResult, 
  ApiResponse, 
  BatchApiResponse 
} from './externalFileUploadService.js'

export interface NodeFileUploadServiceConfig {
  baseUrl: string
  timeout?: number
}

/**
 * Node.js File Upload Service Adapter
 * 
 * This service adapts the Node.js file upload service to work with the existing
 * ExternalFileUploadService interface, providing a seamless integration with
 * the current codebase.
 */
export class NodeFileUploadService {
  private config: NodeFileUploadServiceConfig

  constructor(config: NodeFileUploadServiceConfig) {
    this.config = {
      timeout: 30000,
      ...config
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  private async makeFormRequest<T>(
    endpoint: string,
    formData: FormData,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(this.config.timeout!),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Upload a single file to the Node.js service
   */
  async uploadFile(
    file: File,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', userId)
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }

    const response = await this.makeFormRequest<ApiResponse>(
      '/upload',
      formData
    )

    if (!response.success) {
      throw new Error(response.error || 'Upload failed')
    }

    return response.data!
  }

  /**
   * Upload multiple files in batch
   */
  async uploadFiles(
    files: File[],
    userId: string,
    metadata?: Record<string, any>
  ): Promise<BatchUploadResult> {
    const formData = new FormData()
    
    files.forEach(file => {
      formData.append('files', file)
    })
    
    formData.append('userId', userId)
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }

    const response = await this.makeFormRequest<BatchApiResponse>(
      '/upload/batch',
      formData
    )

    if (!response.success) {
      throw new Error(response.error || 'Batch upload failed')
    }

    return {
      successful: response.data?.uploads || [],
      failed: [],
      totalFiles: files.length,
      successCount: response.data?.uploads?.length || 0,
      failureCount: 0
    }
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.makeRequest(`/files/${encodeURIComponent(filePath)}`, {
      method: 'DELETE'
    })
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<any> {
    const response = await this.makeRequest<ApiResponse>(
      `/files/${encodeURIComponent(filePath)}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to get file metadata')
    }

    return response.data
  }

  /**
   * List all files for a user
   */
  async listFiles(userId: string): Promise<string[]> {
    const response = await this.makeRequest<{ success: boolean; data: string[]; error?: string }>(
      `/files?userId=${encodeURIComponent(userId)}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to list files')
    }

    return response.data || []
  }

  /**
   * Trigger file processing for a RAG document
   */
  async processRAGDocument(
    ragDocumentId: string,
    userId: string,
    options?: {
      batchSize?: number
      timeout?: number
      retryAttempts?: number
      transformOptions?: Record<string, any>
    }
  ): Promise<boolean> {
    const response = await this.makeRequest<ApiResponse>(
      '/processing/process',
      {
        method: 'POST',
        body: JSON.stringify({
          ragDocumentId,
          userId,
          options
        })
      }
    )

    if (!response.success) {
      throw new Error(response.error || 'Processing failed')
    }

    return Boolean(response.data)
  }

  /**
   * Get processing metrics count
   */
  async getProcessingMetricsCount(userId: string): Promise<number> {
    const response = await this.makeRequest<{ success: boolean; data: { count: number }; error?: string }>(
      `/processing/metrics/count?userId=${encodeURIComponent(userId)}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to get metrics count')
    }

    return response.data?.count || 0
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.makeRequest<{ success: boolean; data: { status: string; timestamp: string }; error?: string }>(
      '/health'
    )

    if (!response.success) {
      throw new Error(response.error || 'Health check failed')
    }

    return response.data
  }
}

// Create a default instance
export const nodeFileUploadService = new NodeFileUploadService({
  baseUrl: import.meta.env.VITE_BACKEND_SERVICE_URL || 'http://localhost:3001/api'
}) 