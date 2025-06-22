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
  id: string
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
    id: string
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
      id: string
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
  private readonly defaultTimeout: number = 30000 // 30 seconds
  private readonly defaultChunkSize: number = 5 * 1024 * 1024 // 5MB
  private readonly maxRetries: number = 3

  constructor() {
    this.baseUrl = import.meta.env.VITE_EXTERNAL_UPLOAD_API_URL || 'https://api.example.com'
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
      onChunkComplete,
      chunkSize = this.defaultChunkSize,
      maxRetries = this.maxRetries,
      timeout = this.defaultTimeout
    } = options

    // Validate file
    this.validateFile(file)

    // Generate file path if not provided
    const timestamp = Date.now()
    const fileName = path || `${userId}/${timestamp}-${file.name}`

    // Check if file should be uploaded in chunks
    const shouldChunk = file.size > chunkSize
    
    if (shouldChunk) {
      return this.uploadFileInChunks(file, fileName, userId, {
        ...options,
        chunkSize,
        maxRetries,
        timeout
      })
    } else {
      return this.uploadFileDirect(file, fileName, userId, {
        ...options,
        maxRetries,
        timeout
      })
    }
  }

  /**
   * Upload multiple files in batch
   */
  async uploadBatch(
    files: File[],
    userId: string,
    options: UploadOptions = {}
  ): Promise<BatchUploadResult> {
    console.log(`[ExternalUpload] Starting batch upload for ${files.length} files`)
    
    if (files.length === 0) {
      throw new Error('No files provided for batch upload')
    }

    if (files.length > 50) {
      throw new Error('Batch upload limited to 50 files maximum')
    }

    // Validate all files first
    files.forEach(file => this.validateFile(file))

    const formData = new FormData()
    const fileMetadata: Array<{ name: string; size: number; type: string }> = []

    // Add files to form data
    files.forEach((file, index) => {
      const timestamp = Date.now()
      const fileName = `${userId}/${timestamp}-${index}-${file.name}`
      
      formData.append('files', file, fileName)
      fileMetadata.push({
        name: fileName,
        size: file.size,
        type: file.type
      })
    })

    // Add metadata
    formData.append('userId', userId)
    formData.append('metadata', JSON.stringify({
      ...options.metadata,
      fileCount: files.length,
      uploadType: 'batch',
      timestamp: Date.now()
    }))

    try {
      const response = await this.makeRequest('/upload/batch', {
        method: 'POST',
        body: formData,
        timeout: options.timeout || this.defaultTimeout * files.length
      })

      const result: BatchApiResponse = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Batch upload failed')
      }

      const successful: UploadResult[] = result.data.uploads.map(upload => ({
        path: upload.path,
        url: upload.url,
        size: upload.size,
        id: upload.id,
        metadata: upload.metadata
      }))

      return {
        successful,
        failed: [],
        totalFiles: files.length,
        successCount: successful.length,
        failureCount: 0
      }

    } catch (error) {
      console.error('[ExternalUpload] Batch upload failed:', error)
      
      // Return all files as failed
      const failed = files.map(file => ({
        file,
        error: error instanceof Error ? error.message : 'Upload failed'
      }))

      return {
        successful: [],
        failed,
        totalFiles: files.length,
        successCount: 0,
        failureCount: files.length
      }
    }
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
      timestamp: Date.now()
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
      const response = await this.makeRequestWithProgress('/upload', {
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
        id: result.data.id,
        metadata: result.data.metadata
      }

    } catch (error) {
      console.error('[ExternalUpload] Direct upload failed:', error)
      throw error
    }
  }

  /**
   * Upload file in chunks (for larger files)
   */
  private async uploadFileInChunks(
    file: File,
    fileName: string,
    userId: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    const chunkSize = options.chunkSize || this.defaultChunkSize
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    console.log(`[ExternalUpload] Uploading ${file.name} in ${totalChunks} chunks`)

    // Initialize chunked upload session
    const sessionId = await this.initializeChunkedUpload(file, fileName, userId, totalChunks)
    
    try {
      // Upload chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)
        
        await this.uploadChunk(sessionId, chunkIndex, chunk, options.maxRetries || this.maxRetries)
        
        // Update progress
        const uploadedBytes = end
        const percentage = (uploadedBytes / file.size) * 100
        
        options.onProgress?.({
          percentage,
          uploadedBytes,
          totalBytes: file.size,
          speed: 0, // Will be calculated by the composable
          eta: 0,   // Will be calculated by the composable
          currentChunk: chunkIndex + 1,
          totalChunks
        })
        
        options.onChunkComplete?.(chunkIndex, totalChunks)
      }

      // Finalize upload
      const result = await this.finalizeChunkedUpload(sessionId)
      
      console.log(`[ExternalUpload] Chunked upload completed for ${file.name}`)
      return result

    } catch (error) {
      // Cleanup failed upload
      await this.cleanupChunkedUpload(sessionId)
      throw error
    }
  }

  /**
   * Initialize a chunked upload session
   */
  private async initializeChunkedUpload(
    file: File,
    fileName: string,
    userId: string,
    totalChunks: number
  ): Promise<string> {
    const response = await this.makeRequest('/upload/chunked/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        fileSize: file.size,
        fileType: file.type,
        userId,
        totalChunks,
        chunkSize: this.defaultChunkSize
      })
    })

    const result = await response.json()
    
    if (!result.success || !result.data?.sessionId) {
      throw new Error(result.error || 'Failed to initialize chunked upload')
    }

    return result.data.sessionId
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunk: Blob,
    maxRetries: number
  ): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData()
        formData.append('sessionId', sessionId)
        formData.append('chunkIndex', chunkIndex.toString())
        formData.append('chunk', chunk)

        const response = await this.makeRequest('/upload/chunked/chunk', {
          method: 'POST',
          body: formData,
          timeout: this.defaultTimeout
        })

        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Chunk upload failed')
        }

        return // Success

      } catch (error) {
        lastError = error as Error
        console.warn(`[ExternalUpload] Chunk ${chunkIndex} upload attempt ${attempt + 1} failed:`, error)
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Failed to upload chunk ${chunkIndex} after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

  /**
   * Finalize chunked upload
   */
  private async finalizeChunkedUpload(sessionId: string): Promise<UploadResult> {
    const response = await this.makeRequest('/upload/chunked/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    })

    const result: ApiResponse = await response.json()
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to finalize upload')
    }

    return {
      path: result.data.path,
      url: result.data.url,
      size: result.data.size,
      id: result.data.id,
      metadata: result.data.metadata
    }
  }

  /**
   * Cleanup failed chunked upload
   */
  private async cleanupChunkedUpload(sessionId: string): Promise<void> {
    try {
      await this.makeRequest('/upload/chunked/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })
    } catch (error) {
      console.warn('[ExternalUpload] Failed to cleanup upload session:', error)
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