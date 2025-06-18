import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
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
      totalChunks: 1 // For Supabase storage, we treat it as a single chunk
    }

    try {
      // Create a unique file path: userId/timestamp_filename
      const timestamp = Date.now()
      const filePath = `${authStore.user.id}/${timestamp}_${file.name}`

      console.log('[useFileUpload] Uploading to Supabase storage:', { filePath })

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('health-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('[useFileUpload] Storage upload failed:', uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      console.log('[useFileUpload] File uploaded to storage:', uploadData)

      // Update progress to 50% after upload
      updateProgress(50, file.size)
      options.onProgress?.(50)

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('health-files')
        .getPublicUrl(filePath)

      console.log('[useFileUpload] Generated public URL:', publicUrlData.publicUrl)

      // Insert metadata into health_documents table
      const { data: documentData, error: documentError } = await supabase
        .from('health_documents')
        .insert({
          user_id: authStore.user.id,
          title: file.name,
          file_name: file.name,
          file_type: file.type,
          file_url: publicUrlData.publicUrl,
          size_bytes: file.size,
          uploaded_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (documentError) {
        console.error('[useFileUpload] Database insert failed:', documentError)
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('health-files').remove([filePath])
        throw new Error(`Failed to save file metadata: ${documentError.message}`)
      }

      console.log('[useFileUpload] File metadata saved:', documentData)

      // Update progress to 100%
      updateProgress(100, file.size)
      options.onProgress?.(100)
      options.onChunkComplete?.(0, 1)

      console.log('[useFileUpload] Upload completed successfully:', { 
        documentId: documentData.id,
        fileUrl: publicUrlData.publicUrl 
      })

      return documentData.id
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