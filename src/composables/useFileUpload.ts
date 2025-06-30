import { ref, computed } from 'vue'
import { NodeFileUploadService } from '@/services/nodeFileUploadService'
import { useAuthStore } from '@/stores/auth'

export interface UploadProgress {
  percentage: number
  uploadedBytes: number
  totalBytes: number
  speed: number // bytes per second
  eta: number // estimated time remaining in seconds
  currentChunk: number
  totalChunks: number
}

export function useFileUpload() {
  const authStore = useAuthStore()
  
  console.log('[useFileUpload] Initializing file upload composable')
  
  const uploading = ref(false)
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

  const uploadFile = async (
    file: File,
    options: Partial<{ onProgress?: (percentage: number) => void; onChunkComplete?: (chunkIndex: number, totalChunks: number) => void }> = {}
  ): Promise<string> => {
    console.log('[useFileUpload] Starting file upload:', {
      fileName: file.name,
      fileSize: file.size,
      options
    })

    if (!authStore.user) {
      console.error('[useFileUpload] Upload failed: User not authenticated')
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
      // Use backend service for file upload
      console.log('[useFileUpload] Using backend upload service...')
      
      // Initialize the Node file upload service
      const nodeUploadService = new NodeFileUploadService({
        baseUrl: import.meta.env.VITE_BACKEND_SERVICE_URL || 'http://localhost:3001/api'
      })

      // Simulate progress for the upload process
      updateProgress(25, file.size)
      options.onProgress?.(25)

      // Upload file to backend service with health-specific metadata
      const uploadResult = await nodeUploadService.uploadFile(
        file,
        authStore.user.id,
        {
          source_app: 'web-upload',
          document_type: 'health-data',
          upload_timestamp: new Date().toISOString(),
          original_filename: file.name,
          file_type: file.type
        }
      )

      console.log('[useFileUpload] File uploaded to backend:', uploadResult)

      // Update progress to 75% after upload
      updateProgress(75, file.size)
      options.onProgress?.(75)

      // Final progress update
      updateProgress(100, file.size)
      options.onProgress?.(100)
      options.onChunkComplete?.(0, 1)

      console.log('[useFileUpload] Upload completed successfully:', { 
        documentId: uploadResult.documentId,
        fileUrl: uploadResult.url,
        filePath: uploadResult.path
      })

      return uploadResult.documentId
    } catch (err: any) {
      console.error('[useFileUpload] Upload failed:', err)
      
      // Provide helpful error messages based on common issues
      if (err.message.includes('fetch')) {
        error.value = 'Cannot connect to backend service. Please ensure the backend is running.'
      } else if (err.message.includes('timeout')) {
        error.value = 'Upload timed out. Please try again or check your connection.'
      } else {
        error.value = err.message || 'Upload failed'
      }
      
      throw new Error(error.value)
    } finally {
      uploading.value = false
    }
  }

  const updateProgress = (percentage: number, totalBytes: number) => {
    const now = Date.now()
    const uploadedBytes = Math.round((percentage / 100) * totalBytes)
    
    // Calculate speed (bytes per second)
    const timeDiff = (now - lastProgressTime.value) / 1000
    const bytesDiff = uploadedBytes - lastUploadedBytes.value
    
    if (timeDiff > 0) {
      const currentSpeed = bytesDiff / timeDiff
      // Smooth the speed calculation
      progress.value.speed = progress.value.speed * 0.7 + currentSpeed * 0.3
    }
    
    // Calculate ETA
    const remainingBytes = totalBytes - uploadedBytes
    const eta = progress.value.speed > 0 ? remainingBytes / progress.value.speed : 0
    
    progress.value = {
      ...progress.value,
      percentage,
      uploadedBytes,
      eta
    }
    
    lastProgressTime.value = now
    lastUploadedBytes.value = uploadedBytes
  }

  const cancelUpload = () => {
    console.log('[useFileUpload] Cancelling upload')
    // Implementation would cancel ongoing upload
    uploading.value = false
    error.value = 'Upload cancelled by user'
  }

  const resetProgress = () => {
    console.log('[useFileUpload] Resetting progress')
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
    uploading,
    progress,
    error,
    isLargeFile,
    formattedSpeed,
    formattedETA,
    uploadFile,
    cancelUpload,
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
  return `${minutes}m ${remainingSeconds}s`
}