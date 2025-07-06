import { ref, computed } from 'vue'
import { fileUploadAdapter } from '@/services/fileUploadAdapter'
import type { UploadProgress } from '@/services/externalFileUploadService'
import type { AdapterOptions, UploadResult, BatchUploadResult } from '@/services/fileUploadAdapter'
import { useAuthStore } from '@/stores/auth'

export function useExternalFileUpload() {
  const authStore = useAuthStore()
  
  console.log('[useExternalFileUpload] Initializing external file upload composable')
  
  const uploading = ref(false)
  const batchUploading = ref(false)
  const progress = ref<UploadProgress>({
    percentage: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: 0,
    currentChunk: 0,
    totalChunks: 0
  })
  
  const error = ref<string>('')
  const startTime = ref<number>(0)
  const lastProgressTime = ref<number>(0)
  const lastUploadedBytes = ref<number>(0)

  const isLargeFile = computed(() => progress.value.totalBytes > 100 * 1024 * 1024)
  const formattedSpeed = computed(() => formatBytes(progress.value.speed) + '/s')
  const formattedETA = computed(() => formatTime(progress.value.eta))

  /**
   * Upload a single file
   */
  const uploadFile = async (
    file: File,
    options: AdapterOptions = {}
  ): Promise<UploadResult> => {
    console.log('[useExternalFileUpload] Starting file upload:', {
      fileName: file.name,
      fileSize: file.size,
      options
    })

    if (!authStore.user) {
      console.error('[useExternalFileUpload] Upload failed: User not authenticated')
      throw new Error('User not authenticated')
    }

    uploading.value = true
    error.value = ''
    startTime.value = Date.now()
    lastProgressTime.value = startTime.value
    lastUploadedBytes.value = 0
    
    progress.value = {
      percentage: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      speed: 0,
      eta: 0,
      currentChunk: 0,
      totalChunks: 1
    }

    try {
      const uploadOptions: AdapterOptions = {
        ...options,
        onProgress: (progressData: UploadProgress) => {
          updateProgress(progressData)
          options.onProgress?.(progressData)
        },
        onChunkComplete: (chunkIndex: number, totalChunks: number) => {
          progress.value.currentChunk = chunkIndex + 1
          progress.value.totalChunks = totalChunks
          options.onChunkComplete?.(chunkIndex, totalChunks)
        }
      }

      console.log('[useExternalFileUpload] Uploading with adapter')
      const result = await fileUploadAdapter.uploadFile(
        file,
        authStore.user.id,
        undefined,
        uploadOptions
      )

      console.log('[useExternalFileUpload] Upload completed successfully:', result)
      return result

    } catch (err: any) {
      console.error('[useExternalFileUpload] Upload failed:', err)
      error.value = err.message || 'Upload failed'
      throw err
    } finally {
      uploading.value = false
    }
  }

  /**
   * Upload multiple files in batch
   */
  const uploadBatch = async (
    files: File[],
    options: AdapterOptions = {}
  ): Promise<BatchUploadResult> => {
    console.log('[useExternalFileUpload] Starting batch upload:', {
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      options
    })

    if (!authStore.user) {
      console.error('[useExternalFileUpload] Batch upload failed: User not authenticated')
      throw new Error('User not authenticated')
    }

    if (files.length === 0) {
      throw new Error('No files provided for upload')
    }

    batchUploading.value = true
    error.value = ''
    
    // Calculate total size for progress tracking
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    progress.value = {
      percentage: 0,
      uploadedBytes: 0,
      totalBytes: totalSize,
      speed: 0,
      eta: 0,
      currentChunk: 0,
      totalChunks: files.length
    }

    try {
      const batchOptions: AdapterOptions = {
        ...options,
        onProgress: (progressData: UploadProgress) => {
          updateProgress(progressData)
          options.onProgress?.(progressData)
        }
      }

      console.log('[useExternalFileUpload] Uploading batch with adapter')
      const result = await fileUploadAdapter.uploadBatch(
        files,
        authStore.user.id,
        batchOptions
      )

      console.log('[useExternalFileUpload] Batch upload completed:', {
        successful: result.successCount,
        failed: result.failureCount,
        total: result.totalFiles
      })

      return result

    } catch (err: any) {
      console.error('[useExternalFileUpload] Batch upload failed:', err)
      error.value = err.message || 'Batch upload failed'
      throw err
    } finally {
      batchUploading.value = false
    }
  }

  /**
   * Get upload status
   */
  const getUploadStatus = async (uploadId: string) => {
    try {
      return await fileUploadAdapter.getUploadStatus(uploadId)
    } catch (err: any) {
      console.error('[useExternalFileUpload] Failed to get upload status:', err)
      throw err
    }
  }

  /**
   * Cancel an ongoing upload
   */
  const cancelUpload = async (uploadId: string) => {
    try {
      await fileUploadAdapter.cancelUpload(uploadId)
      uploading.value = false
      batchUploading.value = false
      error.value = 'Upload cancelled by user'
    } catch (err: any) {
      console.error('[useExternalFileUpload] Failed to cancel upload:', err)
      throw err
    }
  }


  /**
   * Get file metadata
   */
  const getFileMetadata = async (fileId: string) => {
    try {
      return await fileUploadAdapter.getFileMetadata(fileId)
    } catch (err: any) {
      console.error('[useExternalFileUpload] Failed to get file metadata:', err)
      throw err
    }
  }

  /**
   * Update progress with speed and ETA calculations
   */
  const updateProgress = (progressData: UploadProgress) => {
    const now = Date.now()
    const timeDiff = (now - lastProgressTime.value) / 1000
    const bytesDiff = progressData.uploadedBytes - lastUploadedBytes.value
    
    if (timeDiff > 0) {
      const currentSpeed = bytesDiff / timeDiff
      // Smooth the speed calculation
      progress.value.speed = progress.value.speed * 0.7 + currentSpeed * 0.3
    }
    
    // Calculate ETA
    const remainingBytes = progressData.totalBytes - progressData.uploadedBytes
    const eta = progress.value.speed > 0 ? remainingBytes / progress.value.speed : 0
    
    progress.value = {
      ...progressData,
      speed: progress.value.speed,
      eta
    }
    
    lastProgressTime.value = now
    lastUploadedBytes.value = progressData.uploadedBytes
  }

  /**
   * Reset progress state
   */
  const resetProgress = () => {
    console.log('[useExternalFileUpload] Resetting progress')
    progress.value = {
      percentage: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: 0,
      currentChunk: 0,
      totalChunks: 0
    }
    error.value = ''
  }

  return {
    // State
    uploading,
    batchUploading,
    progress,
    error,
    isLargeFile,
    formattedSpeed,
    formattedETA,
    
    // Methods
    uploadFile,
    uploadBatch,
    getUploadStatus,
    cancelUpload,
    //deleteFile,
    getFileMetadata,
    resetProgress
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`
}