import { externalFileUploadService } from './externalFileUploadService'
import { azureBlob } from './azureBlob'
import { nodeFileUploadService } from './nodeFileUploadService'
import type { UploadOptions, UploadResult, BatchUploadResult } from './externalFileUploadService'

/**
 * File Upload Adapter
 * 
 * This adapter provides a unified interface for file uploads that can switch
 * between different upload services (Azure Blob Storage, External API, Node.js Service)
 * based on configuration or runtime conditions.
 */

export type UploadProvider = 'azure' | 'external' | 'node'

export interface AdapterOptions extends UploadOptions {
  provider?: UploadProvider
  fallbackProvider?: UploadProvider
}

class FileUploadAdapter {
  private defaultProvider: UploadProvider
  private fallbackProvider: UploadProvider

  constructor() {
    // Determine default provider from environment
    this.defaultProvider = (import.meta.env.VITE_UPLOAD_PROVIDER as UploadProvider) || 'external'
    this.fallbackProvider = (import.meta.env.VITE_UPLOAD_FALLBACK_PROVIDER as UploadProvider) || 'azure'
    
    console.log(`[FileUploadAdapter] Initialized with provider: ${this.defaultProvider}, fallback: ${this.fallbackProvider}`)
  }

  /**
   * Upload a single file using the configured provider
   */
  async uploadFile(
    file: File,
    userId: string,
    path?: string,
    options: AdapterOptions = {}
  ): Promise<UploadResult> {
    const provider = options.provider || this.defaultProvider
    const fallback = options.fallbackProvider || this.fallbackProvider
    
    console.log(`[FileUploadAdapter] Uploading file ${file.name} using provider: ${provider}`)
    
    try {
      return await this.uploadWithProvider(provider, file, userId, path, options)
    } catch (error) {
      console.warn(`[FileUploadAdapter] Primary provider ${provider} failed:`, error)
      
      if (fallback && fallback !== provider) {
        console.log(`[FileUploadAdapter] Attempting fallback to provider: ${fallback}`)
        try {
          return await this.uploadWithProvider(fallback, file, userId, path, options)
        } catch (fallbackError) {
          console.error(`[FileUploadAdapter] Fallback provider ${fallback} also failed:`, fallbackError)
          throw new Error(`Upload failed with both ${provider} and ${fallback} providers`)
        }
      }
      
      throw error
    }
  }

  /**
   * Upload multiple files in batch
   */
  async uploadBatch(
    files: File[],
    userId: string,
    options: AdapterOptions = {}
  ): Promise<BatchUploadResult> {
    const provider = options.provider || this.defaultProvider
    
    console.log(`[FileUploadAdapter] Batch uploading ${files.length} files using provider: ${provider}`)
    
    if (provider === 'external') {
      return await externalFileUploadService.uploadBatch(files, userId, options)
    } else if (provider === 'node') {
      return await nodeFileUploadService.uploadBatch(files, userId, options)
    } else {
      // For Azure, we'll upload files individually since it doesn't have native batch support
      return await this.uploadBatchIndividually(files, userId, options)
    }
  }

  /**
   * Upload with a specific provider
   */
  private async uploadWithProvider(
    provider: UploadProvider,
    file: File,
    userId: string,
    path?: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    switch (provider) {
      case 'external':
        return await externalFileUploadService.uploadFile(file, userId, path, options)
      
      case 'node':
        return await nodeFileUploadService.uploadFile(file, userId, path, options)
      
      case 'azure':
        // Adapt Azure Blob Storage to match our interface
        const azureResult = await azureBlob.uploadFile(file, userId, path)
        return {
          path: azureResult.path,
          url: azureResult.url,
          size: azureResult.size,
          id: azureResult.path, // Use path as ID for Azure
          metadata: options.metadata
        }
      
      default:
        throw new Error(`Unsupported upload provider: ${provider}`)
    }
  }

  /**
   * Upload files individually for providers that don't support batch uploads
   */
  private async uploadBatchIndividually(
    files: File[],
    userId: string,
    options: AdapterOptions = {}
  ): Promise<BatchUploadResult> {
    const successful: UploadResult[] = []
    const failed: Array<{ file: File; error: string }> = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        // Update progress for batch upload
        const batchProgress = ((i + 1) / files.length) * 100
        console.log(`[FileUploadAdapter] Batch progress: ${batchProgress.toFixed(1)}% (${i + 1}/${files.length})`)
        
        const result = await this.uploadWithProvider(
          options.provider || this.defaultProvider,
          file,
          userId,
          undefined,
          options
        )
        
        successful.push(result)
      } catch (error) {
        console.error(`[FileUploadAdapter] Failed to upload ${file.name}:`, error)
        failed.push({
          file,
          error: error instanceof Error ? error.message : 'Upload failed'
        })
      }
    }
    
    return {
      successful,
      failed,
      totalFiles: files.length,
      successCount: successful.length,
      failureCount: failed.length
    }
  }

  /**
   * Get upload status (supported by external and node providers)
   */
  async getUploadStatus(uploadId: string, provider?: UploadProvider): Promise<{
    status: 'pending' | 'uploading' | 'completed' | 'failed'
    progress?: number
    error?: string
  }> {
    const targetProvider = provider || this.defaultProvider
    
    if (targetProvider === 'external') {
      return await externalFileUploadService.getUploadStatus(uploadId)
    } else if (targetProvider === 'node') {
      return await nodeFileUploadService.getUploadStatus(uploadId)
    } else {
      throw new Error(`Upload status tracking not supported by provider: ${targetProvider}`)
    }
  }

  /**
   * Cancel an ongoing upload (supported by external and node providers)
   */
  async cancelUpload(uploadId: string, provider?: UploadProvider): Promise<void> {
    const targetProvider = provider || this.defaultProvider
    
    if (targetProvider === 'external') {
      return await externalFileUploadService.cancelUpload(uploadId)
    } else if (targetProvider === 'node') {
      return await nodeFileUploadService.cancelUpload(uploadId)
    } else {
      throw new Error(`Upload cancellation not supported by provider: ${targetProvider}`)
    }
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(fileId: string, provider?: UploadProvider): Promise<void> {
    const targetProvider = provider || this.defaultProvider
    
    if (targetProvider === 'external') {
      return await externalFileUploadService.deleteFile(fileId)
    } else if (targetProvider === 'node') {
      return await nodeFileUploadService.deleteFile(fileId)
    } else if (targetProvider === 'azure') {
      return await azureBlob.deleteFile(fileId)
    } else {
      throw new Error(`File deletion not supported by provider: ${targetProvider}`)
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string, provider?: UploadProvider): Promise<Record<string, any>> {
    const targetProvider = provider || this.defaultProvider
    
    if (targetProvider === 'external') {
      return await externalFileUploadService.getFileMetadata(fileId)
    } else if (targetProvider === 'node') {
      return await nodeFileUploadService.getFileMetadata(fileId)
    } else if (targetProvider === 'azure') {
      return await azureBlob.getFileMetadata(fileId)
    } else {
      throw new Error(`File metadata retrieval not supported by provider: ${targetProvider}`)
    }
  }

  /**
   * Set the default upload provider
   */
  setDefaultProvider(provider: UploadProvider): void {
    this.defaultProvider = provider
    console.log(`[FileUploadAdapter] Default provider changed to: ${provider}`)
  }

  /**
   * Get current provider configuration
   */
  getProviderConfig(): {
    default: UploadProvider
    fallback: UploadProvider
    available: UploadProvider[]
  } {
    return {
      default: this.defaultProvider,
      fallback: this.fallbackProvider,
      available: ['azure', 'external', 'node']
    }
  }
}

// Create singleton instance
export const fileUploadAdapter = new FileUploadAdapter()