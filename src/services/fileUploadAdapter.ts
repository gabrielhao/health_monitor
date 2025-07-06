import { externalFileUploadService } from './externalFileUploadService'
import type { UploadOptions, UploadResult, BatchUploadResult } from './externalFileUploadService'

// Export types for other modules to use
export type { UploadResult, BatchUploadResult }

/**
 * File Upload Adapter
 * 
 * This adapter provides a unified interface for file uploads using the external API service.
 * Simplified to only use the external provider.
 */

export interface AdapterOptions extends UploadOptions {
  // Remove provider options since we only use external
}

class FileUploadAdapter {
  constructor() {
    console.log(`[FileUploadAdapter] Initialized with external API provider`)
  }

  /**
   * Upload a single file using the external API
   */
  async uploadFile(
    file: File,
    userId: string,
    path?: string,
    options: AdapterOptions = {}
  ): Promise<UploadResult> {
    console.log(`[FileUploadAdapter] Uploading file ${file.name} using external API`)
    
    return await externalFileUploadService.uploadFile(file, userId, path, options)
  }

  /**
   * Upload multiple files in batch
   */
  async uploadBatch(
    files: File[],
    userId: string,
    options: AdapterOptions = {}
  ): Promise<BatchUploadResult> {
    console.log(`[FileUploadAdapter] Batch uploading ${files.length} files using external API`)
    
    return await this.uploadBatchIndividually(files, userId, options)
  }

  /**
   * Upload files individually for batch uploads
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
        
        const result = await externalFileUploadService.uploadFile(file, userId, undefined, options)
        
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
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<{
    status: 'pending' | 'uploading' | 'completed' | 'failed'
    progress?: number
    error?: string
  }> {
    return await externalFileUploadService.getUploadStatus(uploadId)
  }

  /**
   * Cancel an ongoing upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    return await externalFileUploadService.cancelUpload(uploadId)
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(fileId: string): Promise<void> {
    return await externalFileUploadService.deleteFile(fileId)
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<Record<string, any>> {
    return await externalFileUploadService.getFileMetadata(fileId)
  }
}

// Create singleton instance
export const fileUploadAdapter = new FileUploadAdapter()