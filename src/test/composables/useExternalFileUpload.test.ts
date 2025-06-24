import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExternalFileUpload } from '@/composables/useExternalFileUpload'
import { createMockFile, createMockUser } from '../mocks/supabase'

// Mock the file upload adapter
vi.mock('@/services/fileUploadAdapter', () => ({
  fileUploadAdapter: {
    uploadFile: vi.fn(),
    uploadBatch: vi.fn(),
    getUploadStatus: vi.fn(),
    cancelUpload: vi.fn(),
    deleteFile: vi.fn(),
    getFileMetadata: vi.fn(),
    setDefaultProvider: vi.fn(),
    getProviderConfig: vi.fn(() => ({
      default: 'external',
      fallback: 'azure',
      available: ['azure', 'external']
    }))
  }
}))

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: createMockUser()
  }))
}))

describe('useExternalFileUpload', () => {
  let mockFile: File

  beforeEach(() => {
    mockFile = createMockFile({
      name: 'test-file.jpg',
      size: 1024 * 1024 // 1MB
    })
    
    vi.clearAllMocks()
  })

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      const expectedResult = {
        path: 'test-path',
        url: 'test-url',
        size: 1024,
        id: 'test-id'
      }
      
      vi.mocked(fileUploadAdapter.uploadFile).mockResolvedValue(expectedResult)
      
      const { uploadFile, uploading, progress } = useExternalFileUpload()

      // Act
      const result = await uploadFile(mockFile)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(uploading.value).toBe(false)
      expect(fileUploadAdapter.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'test-user-id',
        undefined,
        expect.objectContaining({
          onProgress: expect.any(Function),
          onChunkComplete: expect.any(Function)
        })
      )
    })

    it('should handle upload progress', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      
      vi.mocked(fileUploadAdapter.uploadFile).mockImplementation(async (file, userId, path, options) => {
        // Simulate progress updates
        options?.onProgress?.({
          percentage: 50,
          uploadedBytes: 512 * 1024,
          totalBytes: 1024 * 1024,
          speed: 1024 * 1024,
          eta: 0.5,
          currentChunk: 1,
          totalChunks: 2
        })
        
        return {
          path: 'test-path',
          url: 'test-url',
          size: file.size,
          id: 'test-id'
        }
      })
      
      const { uploadFile, progress } = useExternalFileUpload()

      // Act
      await uploadFile(mockFile)

      // Assert
      expect(progress.value.percentage).toBe(50)
      expect(progress.value.uploadedBytes).toBe(512 * 1024)
      expect(progress.value.totalBytes).toBe(1024 * 1024)
    })

    it('should handle chunk completion', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      
      vi.mocked(fileUploadAdapter.uploadFile).mockImplementation(async (file, userId, path, options) => {
        // Simulate chunk completion
        options?.onChunkComplete?.(0, 2)
        options?.onChunkComplete?.(1, 2)
        
        return {
          path: 'test-path',
          url: 'test-url',
          size: file.size,
          id: 'test-id'
        }
      })
      
      const { uploadFile, progress } = useExternalFileUpload()

      // Act
      await uploadFile(mockFile)

      // Assert
      expect(progress.value.currentChunk).toBe(2)
      expect(progress.value.totalChunks).toBe(2)
    })

    it('should handle upload errors', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      
      vi.mocked(fileUploadAdapter.uploadFile).mockRejectedValue(new Error('Upload failed'))
      
      const { uploadFile, error, uploading } = useExternalFileUpload()

      // Act & Assert
      await expect(uploadFile(mockFile)).rejects.toThrow('Upload failed')
      expect(error.value).toBe('Upload failed')
      expect(uploading.value).toBe(false)
    })

    it('should require authentication', async () => {
      // Arrange
      const { useAuthStore } = await import('@/stores/auth')
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any)
      
      const { uploadFile } = useExternalFileUpload()

      // Act & Assert
      await expect(uploadFile(mockFile)).rejects.toThrow('User not authenticated')
    })
  })

  describe('uploadBatch', () => {
    it('should upload multiple files in batch', async () => {
      // Arrange
      const files = [
        mockFile,
        createMockFile({ name: 'file2.jpg', size: 2048 })
      ]
      
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      const expectedResult = {
        successful: [
          { path: 'path1', url: 'url1', size: 1024, id: 'id1' },
          { path: 'path2', url: 'url2', size: 2048, id: 'id2' }
        ],
        failed: [],
        totalFiles: 2,
        successCount: 2,
        failureCount: 0
      }
      
      vi.mocked(fileUploadAdapter.uploadBatch).mockResolvedValue(expectedResult)
      
      const { uploadBatch, batchUploading } = useExternalFileUpload()

      // Act
      const result = await uploadBatch(files)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(batchUploading.value).toBe(false)
      expect(fileUploadAdapter.uploadBatch).toHaveBeenCalledWith(
        files,
        'test-user-id',
        expect.objectContaining({
          onProgress: expect.any(Function)
        })
      )
    })

    it('should handle empty file array', async () => {
      // Arrange
      const { uploadBatch } = useExternalFileUpload()

      // Act & Assert
      await expect(uploadBatch([])).rejects.toThrow('No files provided for upload')
    })

    it('should require authentication for batch upload', async () => {
      // Arrange
      const { useAuthStore } = await import('@/stores/auth')
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any)
      
      const { uploadBatch } = useExternalFileUpload()

      // Act & Assert
      await expect(uploadBatch([mockFile])).rejects.toThrow('User not authenticated')
    })
  })

  describe('getUploadStatus', () => {
    it('should get upload status', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      const expectedStatus = { status: 'completed' as const, progress: 100 }
      
      vi.mocked(fileUploadAdapter.getUploadStatus).mockResolvedValue(expectedStatus)
      
      const { getUploadStatus } = useExternalFileUpload()

      // Act
      const result = await getUploadStatus('test-id')

      // Assert
      expect(result).toEqual(expectedStatus)
      expect(fileUploadAdapter.getUploadStatus).toHaveBeenCalledWith('test-id')
    })
  })

  describe('cancelUpload', () => {
    it('should cancel upload', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      
      vi.mocked(fileUploadAdapter.cancelUpload).mockResolvedValue()
      
      const { cancelUpload, uploading, batchUploading, error } = useExternalFileUpload()

      // Act
      await cancelUpload('test-id')

      // Assert
      expect(uploading.value).toBe(false)
      expect(batchUploading.value).toBe(false)
      expect(error.value).toBe('Upload cancelled by user')
      expect(fileUploadAdapter.cancelUpload).toHaveBeenCalledWith('test-id')
    })
  })

  describe('deleteFile', () => {
    it('should delete file', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      
      vi.mocked(fileUploadAdapter.deleteFile).mockResolvedValue()
      
      const { deleteFile } = useExternalFileUpload()

      // Act
      await deleteFile('test-id')

      // Assert
      expect(fileUploadAdapter.deleteFile).toHaveBeenCalledWith('test-id')
    })
  })

  describe('getFileMetadata', () => {
    it('should get file metadata', async () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      const expectedMetadata = {
        id: 'test-id',
        url: 'test-url',
        path: 'test-path',
        size: 1024,
        type: 'image/jpeg',
        uploadedAt: '2024-01-01T00:00:00Z'
      }
      
      vi.mocked(fileUploadAdapter.getFileMetadata).mockResolvedValue(expectedMetadata)
      
      const { getFileMetadata } = useExternalFileUpload()

      // Act
      const result = await getFileMetadata('test-id')

      // Assert
      expect(result).toEqual(expectedMetadata)
      expect(fileUploadAdapter.getFileMetadata).toHaveBeenCalledWith('test-id')
    })
  })

  describe('resetProgress', () => {
    it('should reset progress state', () => {
      // Arrange
      const { resetProgress, progress, error } = useExternalFileUpload()
      
      // Set some initial values
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

  describe('switchProvider', () => {
    it('should switch upload provider', () => {
      // Arrange
      const { fileUploadAdapter } = await import('@/services/fileUploadAdapter')
      const { switchProvider } = useExternalFileUpload()

      // Act
      switchProvider('azure')

      // Assert
      expect(fileUploadAdapter.setDefaultProvider).toHaveBeenCalledWith('azure')
    })
  })

  describe('getProviderConfig', () => {
    it('should get provider configuration', () => {
      // Arrange
      const { getProviderConfig } = useExternalFileUpload()

      // Act
      const config = getProviderConfig()

      // Assert
      expect(config).toEqual({
        default: 'external',
        fallback: 'azure',
        available: ['azure', 'external']
      })
    })
  })

  describe('computed properties', () => {
    it('should detect large files correctly', () => {
      // Arrange
      const { progress, isLargeFile } = useExternalFileUpload()

      // Act & Assert
      progress.value.totalBytes = 50 * 1024 * 1024 // 50MB
      expect(isLargeFile.value).toBe(false)

      progress.value.totalBytes = 150 * 1024 * 1024 // 150MB
      expect(isLargeFile.value).toBe(true)
    })

    it('should format speed correctly', () => {
      // Arrange
      const { progress, formattedSpeed } = useExternalFileUpload()

      // Act & Assert
      progress.value.speed = 1024
      expect(formattedSpeed.value).toBe('1.00 KB/s')

      progress.value.speed = 1024 * 1024
      expect(formattedSpeed.value).toBe('1.00 MB/s')
    })

    it('should format ETA correctly', () => {
      // Arrange
      const { progress, formattedETA } = useExternalFileUpload()

      // Act & Assert
      progress.value.eta = 30
      expect(formattedETA.value).toBe('30s')

      progress.value.eta = 90
      expect(formattedETA.value).toBe('1m 30s')

      progress.value.eta = 3661
      expect(formattedETA.value).toBe('1h 1m 1s')
    })
  })
})