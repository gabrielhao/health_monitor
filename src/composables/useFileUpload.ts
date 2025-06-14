import { ref, computed } from 'vue'
import { chunkUploadService, type ChunkUploadOptions } from '@/services/chunkUploadService'
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
    options: Partial<ChunkUploadOptions> = {}
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
      totalChunks: Math.ceil(file.size / (options.chunkSize || 5 * 1024 * 1024))
    }

    try {
      const uploadOptions: ChunkUploadOptions = {
        ...options,
        onProgress: (percentage: number) => {
          console.log('[useFileUpload] Upload progress:', {
            percentage,
            currentChunk: progress.value.currentChunk,
            totalChunks: progress.value.totalChunks,
            speed: progress.value.speed
          })
          updateProgress(percentage, file.size)
          options.onProgress?.(percentage)
        },
        onChunkComplete: (chunkIndex: number, totalChunks: number) => {
          console.log('[useFileUpload] Chunk completed:', {
            chunkIndex,
            totalChunks
          })
          progress.value.currentChunk = chunkIndex + 1
          progress.value.totalChunks = totalChunks
          options.onChunkComplete?.(chunkIndex, totalChunks)
        }
      }

      const sessionId = await chunkUploadService.processXMLFile(
        file,
        authStore.user.id,
        uploadOptions
      )

      console.log('[useFileUpload] Upload completed successfully:', { sessionId })
      return sessionId
    } catch (err: any) {
      console.error('[useFileUpload] Upload failed:', err)
      error.value = err.message || 'Upload failed'
      throw err
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
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatTime(seconds: number): string {
  if (seconds === 0) return '--'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  let result = ''
  if (hours > 0) result += `${hours}h `
  if (minutes > 0) result += `${minutes}m `
  result += `${remainingSeconds}s`
  
  return result
}