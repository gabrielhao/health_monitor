import { ref, computed, readonly } from 'vue'

export interface UploadProgressItem {
  filename: string
  size: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  chunks?: {
    completed: number
    total: number
  }
  speed?: string
  eta?: string
  startTime?: number
}

export const useUploadProgress = () => {
  const progressItems = ref<UploadProgressItem[]>([])

  const initializeProgress = (files: File[]): void => {
    progressItems.value = files.map(file => ({
      filename: file.name,
      size: file.size,
      status: 'pending' as const,
      progress: 0,
      startTime: Date.now()
    }))
  }

  const updateProgress = (
    index: number, 
    updates: Partial<UploadProgressItem>
  ): void => {
    if (index >= 0 && index < progressItems.value.length) {
      progressItems.value[index] = {
        ...progressItems.value[index],
        ...updates
      }
    }
  }

  const updateProgressByFilename = (
    filename: string,
    updates: Partial<UploadProgressItem>
  ): void => {
    const index = progressItems.value.findIndex(item => item.filename === filename)
    if (index !== -1) {
      updateProgress(index, updates)
    }
  }

  const setStatus = (index: number, status: UploadProgressItem['status']): void => {
    updateProgress(index, { status })
  }

  const setProgress = (index: number, progress: number): void => {
    const item = progressItems.value[index]
    if (item && item.startTime) {
      const elapsed = Date.now() - item.startTime
      const speed = calculateSpeed(item.size, progress, elapsed)
      const eta = calculateETA(progress, elapsed)
      
      updateProgress(index, { 
        progress, 
        speed: formatSpeed(speed),
        eta: formatETA(eta)
      })
    } else {
      updateProgress(index, { progress })
    }
  }

  const setError = (index: number, error: string): void => {
    updateProgress(index, { 
      status: 'failed',
      error,
      progress: 0
    })
  }

  const setChunkProgress = (
    index: number, 
    completed: number, 
    total: number
  ): void => {
    const chunkProgress = total > 0 ? Math.round((completed / total) * 100) : 0
    updateProgress(index, {
      chunks: { completed, total },
      progress: chunkProgress
    })
  }

  const clearProgress = (): void => {
    progressItems.value = []
  }

  const removeItem = (index: number): void => {
    if (index >= 0 && index < progressItems.value.length) {
      progressItems.value.splice(index, 1)
    }
  }

  // Helper functions
  const calculateSpeed = (fileSize: number, progress: number, elapsed: number): number => {
    if (elapsed === 0 || progress === 0) return 0
    const bytesUploaded = (fileSize * progress) / 100
    return bytesUploaded / (elapsed / 1000) // bytes per second
  }

  const calculateETA = (progress: number, elapsed: number): number => {
    if (progress === 0 || progress >= 100) return 0
    return (elapsed * (100 - progress)) / progress
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s'
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024))
    return Math.round(bytesPerSecond / Math.pow(1024, i) * 100) / 100 + ' ' + units[i]
  }

  const formatETA = (milliseconds: number): string => {
    if (milliseconds <= 0) return '0s'
    const seconds = Math.floor(milliseconds / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  // Computed properties
  const hasActiveUploads = computed(() => 
    progressItems.value.some(item => 
      item.status === 'uploading' || item.status === 'processing'
    )
  )

  const completedUploads = computed(() => 
    progressItems.value.filter(item => item.status === 'completed').length
  )

  const failedUploads = computed(() => 
    progressItems.value.filter(item => item.status === 'failed').length
  )

  const totalProgress = computed(() => {
    if (progressItems.value.length === 0) return 0
    const totalProgress = progressItems.value.reduce((sum, item) => sum + item.progress, 0)
    return Math.round(totalProgress / progressItems.value.length)
  })

  return {
    progressItems: readonly(progressItems),
    initializeProgress,
    updateProgress,
    updateProgressByFilename,
    setStatus,
    setProgress,
    setError,
    setChunkProgress,
    clearProgress,
    removeItem,
    hasActiveUploads,
    completedUploads,
    failedUploads,
    totalProgress
  }
} 