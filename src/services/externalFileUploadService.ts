import type { UploadProgress } from '@/composables/useFileUpload'

export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
  onProgress?: (progress: UploadProgress) => void
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
  chunkSize?: number
  maxRetries?: number
  timeout?: number
}

export interface UploadResult {
  path: string
  url: string
  size: number
  documentId: string
  metadata?: Record<string, any>
}

export interface BatchUploadResult {
  successful: UploadResult[]
  failed: Array<{ file: File; error: string }>
  totalFiles: number
  successCount: number
  failureCount: number
}

export interface ApiResponse {
  success: boolean
  data?: {
    documentId: string
    url: string
    path: string
    size: number
    metadata?: Record<string, any>
  }
  error?: string
  message?: string
}

export interface BatchApiResponse {
  success: boolean
  data?: {
    uploads: Array<{
      documentId: string
      url: string
      path: string
      size: number
      filename: string
      metadata?: Record<string, any>
    }>
  }
  error?: string
  message?: string
}

class ExternalFileUploadService {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly defaultTimeout: number = 300000 // 5 minutes
  private readonly maxRetries: number = 3

  constructor() {
    this.baseUrl = import.meta.env.VITE_EXTERNAL_UPLOAD_API_URL || ''
    this.apiKey = import.meta.env.VITE_EXTERNAL_UPLOAD_API_KEY || ''
    
    if (!this.baseUrl) {
      throw new Error('External upload API URL is not configured')
    }
    
    if (!this.apiKey) {
      console.warn('External upload API key is not configured - requests may fail')
    }
  }

  /**
   * Upload a single file to the external API
   */
  async uploadFile(
    file: File,
    userId: string,
    path?: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    console.log(`[ExternalUpload] Starting upload for file: ${file.name}`)
    
    const {
      contentType = file.type,
      metadata = {},
      onProgress,
      maxRetries = this.maxRetries,
      timeout = this.defaultTimeout
    } = options

    // Validate file
    this.validateFile(file)

    // Generate file path if not provided
    const timestamp = Date.now()
    const fileName = path || `${userId}/${timestamp}-${file.name}`


    return this.uploadFileDirect(file, fileName, userId, {
        ...options,
        maxRetries,
        timeout
      })

  }

  /**
   * Upload file directly (for smaller files)
   */
  private async uploadFileDirect(
    file: File,
    fileName: string,
    userId: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    const formData = new FormData()
    formData.append('file', file, fileName)
    formData.append('userId', userId)
    formData.append('metadata', JSON.stringify({
      ...options.metadata,
      originalName: file.name,
      uploadType: 'direct',
      timestamp: Date.now().toString()
    }))

    // Track progress for direct upload
    let uploadedBytes = 0
    const totalBytes = file.size

    const updateProgress = (loaded: number) => {
      uploadedBytes = loaded
      const percentage = (loaded / totalBytes) * 100
      
      options.onProgress?.({
        percentage,
        uploadedBytes: loaded,
        totalBytes,
        speed: 0, // Will be calculated by the composable
        eta: 0,   // Will be calculated by the composable
        currentChunk: 1,
        totalChunks: 1
      })
    }

    try {
      const response = await this.makeRequestWithProgress('', {
        method: 'POST',
        body: formData,
        timeout: options.timeout || this.defaultTimeout
      }, updateProgress)

      const result: ApiResponse = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Upload failed')
      }

      // Final progress update
      updateProgress(totalBytes)
      options.onChunkComplete?.(0, 1)

      return {
        path: result.data.path,
        url: result.data.url,
        size: result.data.size,
        documentId: result.data.documentId,
        metadata: result.data.metadata
      }

    } catch (error) {
      console.error('[ExternalUpload] Direct upload failed:', error)
      throw error
    }
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File): void {
    if (!file) {
      throw new Error('File is required')
    }

    if (file.size === 0) {
      throw new Error('File is empty')
    }

    // 5GB limit
    const maxSize = 5 * 1024 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5GB limit')
    }

    // Check for supported file types (basic validation)
    const supportedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'text/plain', 'text/csv', 'text/xml', 'application/xml', 'application/json',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      // Health data formats
      'application/x-apple-health', 'application/x-google-fit'
    ]

    if (file.type && !supportedTypes.includes(file.type)) {
      console.warn(`[ExternalUpload] File type ${file.type} may not be supported`)
    }
  }

  /**
   * Make HTTP request with authentication
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers = new Headers(options.headers)
    
    // Add authentication
    if (this.apiKey) {
      headers.set('Authorization', `Bearer ${this.apiKey}`)
    }
    
    // Add common headers
    headers.set('X-Client-Version', '1.0.0')
    headers.set('X-Client-Name', 'aivital-web')

    const requestOptions: RequestInit = {
      ...options,
      headers
    }

    // Add timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout)
    requestOptions.signal = controller.signal

    try {
      const response = await fetch(url, requestOptions)
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      
      throw error
    }
  }

  /**
   * Make HTTP request with progress tracking
   */
  private async makeRequestWithProgress(
    endpoint: string,
    options: RequestInit,
    onProgress: (loaded: number) => void
  ): Promise<Response> {
    // For progress tracking, we'll use XMLHttpRequest
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${this.baseUrl}${endpoint}`

      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded)
        }
      })

      // Set up response handlers
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Create a Response-like object
          const response = {
            ok: true,
            status: xhr.status,
            statusText: xhr.statusText,
            json: () => Promise.resolve(JSON.parse(xhr.responseText)),
            text: () => Promise.resolve(xhr.responseText)
          } as Response
          
          resolve(response)
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'))
      })

      xhr.addEventListener('timeout', () => {
        reject(new Error('Request timeout'))
      })

      // Configure request
      xhr.open(options.method || 'GET', url)
      xhr.timeout = options.timeout || this.defaultTimeout

      // Add headers
      if (this.apiKey) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.apiKey}`)
      }
      xhr.setRequestHeader('X-Client-Version', '1.0.0')
      xhr.setRequestHeader('X-Client-Name', 'aivital-web')

      // Send request
      xhr.send(options.body as any)
    })
  }

  /**
   * Get upload status for a file
   */
  async getUploadStatus(uploadId: string): Promise<{
    status: 'pending' | 'uploading' | 'completed' | 'failed'
    progress?: number
    error?: string
  }> {
    try {
      const response = await this.makeRequest(`/upload/status/${uploadId}`, {
        method: 'GET'
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get upload status')
      }

      return result.data
    } catch (error) {
      console.error('[ExternalUpload] Failed to get upload status:', error)
      throw error
    }
  }

  /**
   * Cancel an ongoing upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    try {
      await this.makeRequest(`/upload/cancel/${uploadId}`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('[ExternalUpload] Failed to cancel upload:', error)
      throw error
    }
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      const response = await this.makeRequest(`/files/${fileId}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('[ExternalUpload] Failed to delete file:', error)
      throw error
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<{
    id: string
    url: string
    path: string
    size: number
    type: string
    uploadedAt: string
    metadata?: Record<string, any>
  }> {
    try {
      const response = await this.makeRequest(`/files/${fileId}`, {
        method: 'GET'
      })

      const result = await response.json()
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get file metadata')
      }

      return result.data
    } catch (error) {
      console.error('[ExternalUpload] Failed to get file metadata:', error)
      throw error
    }
  }
}

// Create singleton instance
export const externalFileUploadService = new ExternalFileUploadService()

// Export class for testing
export { ExternalFileUploadService }