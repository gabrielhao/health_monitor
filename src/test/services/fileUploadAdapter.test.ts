import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileUploadAdapter } from '@/services/fileUploadAdapter'
import { createMockFile } from '../mocks/supabase'

// Mock the services
vi.mock('@/services/externalFileUploadService', () => ({
  externalFileUploadService: {
    uploadFile: vi.fn(),
    uploadBatch: vi.fn(),
    getUploadStatus: vi.fn(),
    cancelUpload: vi.fn(),
    deleteFile: vi.fn(),
    getFileMetadata: vi.fn()
  }
}))

vi.mock('@/services/azureBlob', () => ({
  azureBlob: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    getFileMetadata: vi.fn()
  }
}))

describe('FileUploadAdapter', () => {
  let adapter: FileUploadAdapter
  let mockFile: File
  const userId = 'test-user-id'

  beforeEach(() => {
    vi.stubEnv('VITE_UPLOAD_PROVIDER', 'external')
    vi.stubEnv('VITE_UPLOAD_FALLBACK_PROVIDER', 'azure')
    
    adapter = new FileUploadAdapter()
    mockFile = createMockFile({
      name: 'test-file.jpg',
      size: 1024 * 1024
    })
    
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default providers from environment', () => {
      const config = adapter.getProviderConfig()
      expect(config.default).toBe('external')
      expect(config.fallback).toBe('azure')
      expect(config.available).toEqual(['azure', 'external'])
    })

    it('should use fallback defaults when environment variables are not set', () => {
      vi.stubEnv('VITE_UPLOAD_PROVIDER', '')
      vi.stubEnv('VITE_UPLOAD_FALLBACK_PROVIDER', '')
      
      const newAdapter = new FileUploadAdapter()
      const config = newAdapter.getProviderConfig()
      
      expect(config.default).toBe('external')
      expect(config.fallback).toBe('azure')
    })
  })

  describe('uploadFile', () => {
    it('should upload file using external provider', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      const expectedResult = {
        path: 'test-path',
        url: 'test-url',
        size: 1024,
        id: 'test-id'
      }
      
      vi.mocked(externalFileUploadService.uploadFile).mockResolvedValue(expectedResult)

      // Act
      const result = await adapter.uploadFile(mockFile, userId)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(externalFileUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        userId,
        undefined,
        {}
      )
    })

    it('should upload file using azure provider when specified', async () => {
      // Arrange
      const { azureBlob } = await import('@/services/azureBlob')
      const azureResult = {
        path: 'azure-path',
        url: 'azure-url',
        size: 1024
      }
      
      vi.mocked(azureBlob.uploadFile).mockResolvedValue(azureResult)

      // Act
      const result = await adapter.uploadFile(mockFile, userId, undefined, {
        provider: 'azure'
      })

      // Assert
      expect(result).toEqual({
        path: 'azure-path',
        url: 'azure-url',
        size: 1024,
        id: 'azure-path',
        metadata: undefined
      })
      expect(azureBlob.uploadFile).toHaveBeenCalledWith(mockFile, userId, undefined)
    })

    it('should fallback to secondary provider on failure', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      const { azureBlob } = await import('@/services/azureBlob')
      
      vi.mocked(externalFileUploadService.uploadFile).mockRejectedValue(new Error('External service failed'))
      vi.mocked(azureBlob.uploadFile).mockResolvedValue({
        path: 'fallback-path',
        url: 'fallback-url',
        size: 1024
      })

      // Act
      const result = await adapter.uploadFile(mockFile, userId)

      // Assert
      expect(result.path).toBe('fallback-path')
      expect(externalFileUploadService.uploadFile).toHaveBeenCalled()
      expect(azureBlob.uploadFile).toHaveBeenCalled()
    })

    it('should throw error when both providers fail', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      const { azureBlob } = await import('@/services/azureBlob')
      
      vi.mocked(externalFileUploadService.uploadFile).mockRejectedValue(new Error('External failed'))
      vi.mocked(azureBlob.uploadFile).mockRejectedValue(new Error('Azure failed'))

      // Act & Assert
      await expect(adapter.uploadFile(mockFile, userId)).rejects.toThrow(
        'Upload failed with both external and azure providers'
      )
    })

    it('should not fallback when same provider is specified for both', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      
      vi.mocked(externalFileUploadService.uploadFile).mockRejectedValue(new Error('Service failed'))

      // Act & Assert
      await expect(adapter.uploadFile(mockFile, userId, undefined, {
        provider: 'external',
        fallbackProvider: 'external'
      })).rejects.toThrow('Service failed')
    })
  })

  describe('uploadBatch', () => {
    it('should upload batch using external provider', async () => {
      // Arrange
      const files = [mockFile, createMockFile({ name: 'file2.jpg' })]
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      const expectedResult = {
        successful: [
          { path: 'path1', url: 'url1', size: 1024, id: 'id1' },
          { path: 'path2', url: 'url2', size: 1024, id: 'id2' }
        ],
        failed: [],
        totalFiles: 2,
        successCount: 2,
        failureCount: 0
      }
      
      vi.mocked(externalFileUploadService.uploadBatch).mockResolvedValue(expectedResult)

      // Act
      const result = await adapter.uploadBatch(files, userId)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(externalFileUploadService.uploadBatch).toHaveBeenCalledWith(files, userId, {})
    })

    it('should upload batch individually for azure provider', async () => {
      // Arrange
      const files = [mockFile, createMockFile({ name: 'file2.jpg' })]
      const { azureBlob } = await import('@/services/azureBlob')
      
      vi.mocked(azureBlob.uploadFile)
        .mockResolvedValueOnce({ path: 'path1', url: 'url1', size: 1024 })
        .mockResolvedValueOnce({ path: 'path2', url: 'url2', size: 1024 })

      // Act
      const result = await adapter.uploadBatch(files, userId, { provider: 'azure' })

      // Assert
      expect(result.successCount).toBe(2)
      expect(result.failureCount).toBe(0)
      expect(azureBlob.uploadFile).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures in individual uploads', async () => {
      // Arrange
      const files = [mockFile, createMockFile({ name: 'file2.jpg' })]
      const { azureBlob } = await import('@/services/azureBlob')
      
      vi.mocked(azureBlob.uploadFile)
        .mockResolvedValueOnce({ path: 'path1', url: 'url1', size: 1024 })
        .mockRejectedValueOnce(new Error('Upload failed'))

      // Act
      const result = await adapter.uploadBatch(files, userId, { provider: 'azure' })

      // Assert
      expect(result.successCount).toBe(1)
      expect(result.failureCount).toBe(1)
      expect(result.failed[0].error).toBe('Upload failed')
    })
  })

  describe('getUploadStatus', () => {
    it('should get upload status from external provider', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      const expectedStatus = { status: 'completed' as const, progress: 100 }
      
      vi.mocked(externalFileUploadService.getUploadStatus).mockResolvedValue(expectedStatus)

      // Act
      const result = await adapter.getUploadStatus('test-id')

      // Assert
      expect(result).toEqual(expectedStatus)
      expect(externalFileUploadService.getUploadStatus).toHaveBeenCalledWith('test-id')
    })

    it('should throw error for unsupported provider', async () => {
      // Act & Assert
      await expect(adapter.getUploadStatus('test-id', 'azure')).rejects.toThrow(
        'Upload status tracking not supported by provider: azure'
      )
    })
  })

  describe('cancelUpload', () => {
    it('should cancel upload using external provider', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      
      vi.mocked(externalFileUploadService.cancelUpload).mockResolvedValue()

      // Act
      await adapter.cancelUpload('test-id')

      // Assert
      expect(externalFileUploadService.cancelUpload).toHaveBeenCalledWith('test-id')
    })

    it('should throw error for unsupported provider', async () => {
      // Act & Assert
      await expect(adapter.cancelUpload('test-id', 'azure')).rejects.toThrow(
        'Upload cancellation not supported by provider: azure'
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file using external provider', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      
      vi.mocked(externalFileUploadService.deleteFile).mockResolvedValue()

      // Act
      await adapter.deleteFile('test-id')

      // Assert
      expect(externalFileUploadService.deleteFile).toHaveBeenCalledWith('test-id')
    })

    it('should delete file using azure provider', async () => {
      // Arrange
      const { azureBlob } = await import('@/services/azureBlob')
      
      vi.mocked(azureBlob.deleteFile).mockResolvedValue()

      // Act
      await adapter.deleteFile('test-id', 'azure')

      // Assert
      expect(azureBlob.deleteFile).toHaveBeenCalledWith('test-id')
    })
  })

  describe('getFileMetadata', () => {
    it('should get file metadata using external provider', async () => {
      // Arrange
      const { externalFileUploadService } = await import('@/services/externalFileUploadService')
      const expectedMetadata = {
        id: 'test-id',
        url: 'test-url',
        path: 'test-path',
        size: 1024,
        type: 'image/jpeg',
        uploadedAt: '2024-01-01T00:00:00Z'
      }
      
      vi.mocked(externalFileUploadService.getFileMetadata).mockResolvedValue(expectedMetadata)

      // Act
      const result = await adapter.getFileMetadata('test-id')

      // Assert
      expect(result).toEqual(expectedMetadata)
      expect(externalFileUploadService.getFileMetadata).toHaveBeenCalledWith('test-id')
    })

    it('should get file metadata using azure provider', async () => {
      // Arrange
      const { azureBlob } = await import('@/services/azureBlob')
      const expectedMetadata = { size: 1024, contentType: 'image/jpeg' }
      
      vi.mocked(azureBlob.getFileMetadata).mockResolvedValue(expectedMetadata)

      // Act
      const result = await adapter.getFileMetadata('test-id', 'azure')

      // Assert
      expect(result).toEqual(expectedMetadata)
      expect(azureBlob.getFileMetadata).toHaveBeenCalledWith('test-id')
    })
  })

  describe('setDefaultProvider', () => {
    it('should change default provider', () => {
      // Act
      adapter.setDefaultProvider('azure')

      // Assert
      const config = adapter.getProviderConfig()
      expect(config.default).toBe('azure')
    })
  })

  describe('error handling', () => {
    it('should throw error for unsupported provider', async () => {
      // Act & Assert
      await expect(adapter.uploadFile(mockFile, userId, undefined, {
        provider: 'unsupported' as any
      })).rejects.toThrow('Unsupported upload provider: unsupported')
    })
  })
})