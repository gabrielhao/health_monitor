import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFileUpload } from '@/composables/useFileUpload'
import { createMockFile } from '../mocks/supabase'
import { useAuthStore } from '@/stores/auth'

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

// Mock the chunk upload service
vi.mock('@/services/chunkUploadService', () => ({
  chunkUploadService: {
    uploadFile: vi.fn()
  }
}))

describe('useFileUpload', () => {
  let mockAuthStore: any
  let mockFile: File

  beforeEach(() => {
    mockAuthStore = {
      user: { id: 'test-user-id' }
    }
    ;(useAuthStore as any).mockReturnValue(mockAuthStore)
    
    mockFile = createMockFile({
      name: 'test-file.xml',
      size: 10 * 1024 * 1024 // 10MB
    })
    
    vi.clearAllMocks()
  })

  describe('uploadFile', () => {
    it('should upload file successfully and update progress', async () => {
      // Arrange
      const { uploadFile, progress, uploading } = useFileUpload()
      const { chunkUploadService } = await import('@/services/chunkUploadService')
      
      ;(chunkUploadService.uploadFile as any).mockImplementation(
        (file: File, userId: string, options: any) => {
          // Simulate progress updates
          options.onProgress(50)
          options.onProgress(100)
          options.onChunkComplete(0, 2)
          options.onChunkComplete(1, 2)
          return Promise.resolve('uploaded-file-path')
        }
      )

      // Act
      const result = await uploadFile(mockFile)

      // Assert
      expect(result).toBe('uploaded-file-path')
      expect(progress.value.percentage).toBe(100)
      expect(uploading.value).toBe(false)
      expect(chunkUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'test-user-id',
        expect.objectContaining({
          chunkSize: 5 * 1024 * 1024,
          onProgress: expect.any(Function),
          onChunkComplete: expect.any(Function)
        })
      )
    })

    it('should throw error when user not authenticated', async () => {
      // Arrange
      mockAuthStore.user = null
      const { uploadFile } = useFileUpload()

      // Act & Assert
      await expect(uploadFile(mockFile)).rejects.toThrow('User not authenticated')
    })

    it('should handle upload errors correctly', async () => {
      // Arrange
      const { uploadFile, error, uploading } = useFileUpload()
      const { chunkUploadService } = await import('@/services/chunkUploadService')
      
      ;(chunkUploadService.uploadFile as any).mockRejectedValue(
        new Error('Upload failed')
      )

      // Act & Assert
      await expect(uploadFile(mockFile)).rejects.toThrow('Upload failed')
      expect(error.value).toBe('Upload failed')
      expect(uploading.value).toBe(false)
    })

    it('should calculate upload speed and ETA correctly', async () => {
      // Arrange
      const { uploadFile, progress, formattedSpeed, formattedETA } = useFileUpload()
      const { chunkUploadService } = await import('@/services/chunkUploadService')
      
      ;(chunkUploadService.uploadFile as any).mockImplementation(
        (file: File, userId: string, options: any) => {
          // Simulate gradual progress
          setTimeout(() => options.onProgress(25), 100)
          setTimeout(() => options.onProgress(50), 200)
          setTimeout(() => options.onProgress(75), 300)
          setTimeout(() => options.onProgress(100), 400)
          return new Promise(resolve => 
            setTimeout(() => resolve('uploaded-file-path'), 500)
          )
        }
      )

      // Act
      const uploadPromise = uploadFile(mockFile)
      
      // Wait for some progress
      await new Promise(resolve => setTimeout(resolve, 250))

      // Assert
      expect(progress.value.percentage).toBeGreaterThan(0)
      expect(progress.value.speed).toBeGreaterThan(0)
      expect(formattedSpeed.value).toMatch(/\d+(\.\d+)?\s(B|KB|MB|GB)\/s/)
      expect(formattedETA.value).toMatch(/(\d+h\s)?(\d+m\s)?\d+s|--/)

      await uploadPromise
    })

    it('should handle large files correctly', async () => {
      // Arrange
      const largeFile = createMockFile({
        name: 'large-file.xml',
        size: 500 * 1024 * 1024 // 500MB
      })
      
      const { uploadFile, isLargeFile } = useFileUpload()
      const { chunkUploadService } = await import('@/services/chunkUploadService')
      
      ;(chunkUploadService.uploadFile as any).mockResolvedValue('uploaded-file-path')

      // Act
      await uploadFile(largeFile)

      // Assert
      expect(isLargeFile.value).toBe(true)
    })

    it('should pass custom chunk size option', async () => {
      // Arrange
      const { uploadFile } = useFileUpload()
      const { chunkUploadService } = await import('@/services/chunkUploadService')
      
      ;(chunkUploadService.uploadFile as any).mockResolvedValue('uploaded-file-path')

      const customChunkSize = 10 * 1024 * 1024 // 10MB

      // Act
      await uploadFile(mockFile, { chunkSize: customChunkSize })

      // Assert
      expect(chunkUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'test-user-id',
        expect.objectContaining({
          chunkSize: customChunkSize
        })
      )
    })
  })

  describe('cancelUpload', () => {
    it('should cancel ongoing upload', () => {
      // Arrange
      const { cancelUpload, uploading, error } = useFileUpload()

      // Act
      cancelUpload()

      // Assert
      expect(uploading.value).toBe(false)
      expect(error.value).toBe('Upload cancelled by user')
    })
  })

  describe('resetProgress', () => {
    it('should reset all progress values', () => {
      // Arrange
      const { resetProgress, progress, error } = useFileUpload()
      
      // Set some values first
      progress.value.percentage = 50
      progress.value.uploadedBytes = 1000
      error.value = 'Some error'

      // Act
      resetProgress()

      // Assert
      expect(progress.value.percentage).toBe(0)
      expect(progress.value.uploadedBytes).toBe(0)
      expect(progress.value.totalBytes).toBe(0)
      expect(progress.value.speed).toBe(0)
      expect(progress.value.eta).toBe(0)
      expect(progress.value.currentChunk).toBe(0)
      expect(progress.value.totalChunks).toBe(0)
      expect(error.value).toBe('')
    })
  })

  describe('Computed Properties', () => {
    it('should format speed correctly', () => {
      // Arrange
      const { progress, formattedSpeed } = useFileUpload()

      // Act & Assert
      progress.value.speed = 1024
      expect(formattedSpeed.value).toBe('1.0 KB/s')

      progress.value.speed = 1024 * 1024
      expect(formattedSpeed.value).toBe('1.0 MB/s')

      progress.value.speed = 0
      expect(formattedSpeed.value).toBe('0 B/s')
    })

    it('should format ETA correctly', () => {
      // Arrange
      const { progress, formattedETA } = useFileUpload()

      // Act & Assert
      progress.value.eta = 0
      expect(formattedETA.value).toBe('--')

      progress.value.eta = 30
      expect(formattedETA.value).toBe('30s')

      progress.value.eta = 90
      expect(formattedETA.value).toBe('1m 30s')

      progress.value.eta = 3661
      expect(formattedETA.value).toBe('1h 1m 1s')
    })

    it('should detect large files correctly', () => {
      // Arrange
      const { progress, isLargeFile } = useFileUpload()

      // Act & Assert
      progress.value.totalBytes = 50 * 1024 * 1024 // 50MB
      expect(isLargeFile.value).toBe(false)

      progress.value.totalBytes = 150 * 1024 * 1024 // 150MB
      expect(isLargeFile.value).toBe(true)
    })
  })
})