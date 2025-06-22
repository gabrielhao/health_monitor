import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ExternalFileUploadService } from '@/services/externalFileUploadService'
import { createMockFile } from '../mocks/supabase'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock XMLHttpRequest for progress tracking
const mockXHR = {
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  addEventListener: vi.fn(),
  upload: {
    addEventListener: vi.fn()
  },
  status: 200,
  statusText: 'OK',
  responseText: '{"success": true, "data": {"id": "test-id", "url": "test-url", "path": "test-path", "size": 1024}}',
  timeout: 0
}

global.XMLHttpRequest = vi.fn(() => mockXHR) as any

describe('ExternalFileUploadService', () => {
  let service: ExternalFileUploadService
  let mockFile: File
  const userId = 'test-user-id'

  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('VITE_EXTERNAL_UPLOAD_API_URL', 'https://api.example.com')
    vi.stubEnv('VITE_EXTERNAL_UPLOAD_API_KEY', 'test-api-key')
    
    service = new ExternalFileUploadService()
    mockFile = createMockFile({
      name: 'test-file.jpg',
      size: 1024 * 1024, // 1MB
      type: 'image/jpeg'
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(service).toBeDefined()
    })

    it('should throw error if API URL is not configured', () => {
      vi.stubEnv('VITE_EXTERNAL_UPLOAD_API_URL', '')
      
      expect(() => new ExternalFileUploadService()).toThrow('External upload API URL is not configured')
    })

    it('should warn if API key is not configured', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubEnv('VITE_EXTERNAL_UPLOAD_API_KEY', '')
      
      new ExternalFileUploadService()
      
      expect(consoleSpy).toHaveBeenCalledWith('External upload API key is not configured - requests may fail')
      consoleSpy.mockRestore()
    })
  })

  describe('uploadFile', () => {
    it('should upload small file directly', async () => {
      // Arrange
      const smallFile = createMockFile({
        name: 'small-file.txt',
        size: 1024 // 1KB
      })

      // Mock successful response
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          setTimeout(callback, 0)
        }
      })

      // Act
      const result = await service.uploadFile(smallFile, userId)

      // Assert
      expect(result).toEqual({
        path: 'test-path',
        url: 'test-url',
        size: 1024,
        id: 'test-id'
      })
      expect(mockXHR.open).toHaveBeenCalledWith('POST', 'https://api.example.com/upload')
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer test-api-key')
    })

    it('should upload large file in chunks', async () => {
      // Arrange
      const largeFile = createMockFile({
        name: 'large-file.zip',
        size: 10 * 1024 * 1024 // 10MB
      })

      // Mock chunked upload responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { sessionId: 'test-session-id' }
          })
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'test-id',
              url: 'test-url',
              path: 'test-path',
              size: largeFile.size
            }
          })
        })

      // Act
      const result = await service.uploadFile(largeFile, userId, undefined, {
        chunkSize: 5 * 1024 * 1024 // 5MB chunks
      })

      // Assert
      expect(result).toEqual({
        path: 'test-path',
        url: 'test-url',
        size: largeFile.size,
        id: 'test-id'
      })
      expect(mockFetch).toHaveBeenCalledTimes(4) // init + 2 chunks + finalize
    })

    it('should validate file before upload', async () => {
      // Arrange
      const emptyFile = createMockFile({
        name: 'empty.txt',
        size: 0
      })

      // Act & Assert
      await expect(service.uploadFile(emptyFile, userId)).rejects.toThrow('File is empty')
    })

    it('should reject files larger than 5GB', async () => {
      // Arrange
      const oversizedFile = createMockFile({
        name: 'huge-file.zip',
        size: 6 * 1024 * 1024 * 1024 // 6GB
      })

      // Act & Assert
      await expect(service.uploadFile(oversizedFile, userId)).rejects.toThrow('File size exceeds 5GB limit')
    })

    it('should handle upload progress', async () => {
      // Arrange
      const onProgress = vi.fn()
      
      mockXHR.upload.addEventListener.mockImplementation((event, callback) => {
        if (event === 'progress') {
          // Simulate progress event
          setTimeout(() => callback({ lengthComputable: true, loaded: 512, total: 1024 }), 0)
        }
      })
      
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          setTimeout(callback, 10)
        }
      })

      // Act
      await service.uploadFile(mockFile, userId, undefined, { onProgress })

      // Assert
      expect(onProgress).toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      // Arrange
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(callback, 0)
        }
      })

      // Act & Assert
      await expect(service.uploadFile(mockFile, userId)).rejects.toThrow('Network error')
    })

    it('should handle timeout errors', async () => {
      // Arrange
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'timeout') {
          setTimeout(callback, 0)
        }
      })

      // Act & Assert
      await expect(service.uploadFile(mockFile, userId)).rejects.toThrow('Request timeout')
    })
  })

  describe('uploadBatch', () => {
    it('should upload multiple files in batch', async () => {
      // Arrange
      const files = [
        createMockFile({ name: 'file1.jpg', size: 1024 }),
        createMockFile({ name: 'file2.png', size: 2048 }),
        createMockFile({ name: 'file3.pdf', size: 4096 })
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            uploads: files.map((file, index) => ({
              id: `test-id-${index}`,
              url: `test-url-${index}`,
              path: `test-path-${index}`,
              size: file.size,
              filename: file.name
            }))
          }
        })
      })

      // Act
      const result = await service.uploadBatch(files, userId)

      // Assert
      expect(result.successCount).toBe(3)
      expect(result.failureCount).toBe(0)
      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/upload/batch',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should handle batch upload errors', async () => {
      // Arrange
      const files = [createMockFile({ name: 'file1.jpg', size: 1024 })]

      mockFetch.mockRejectedValue(new Error('Network error'))

      // Act
      const result = await service.uploadBatch(files, userId)

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.failureCount).toBe(1)
      expect(result.failed[0].error).toBe('Network error')
    })

    it('should reject empty file array', async () => {
      // Act & Assert
      await expect(service.uploadBatch([], userId)).rejects.toThrow('No files provided for batch upload')
    })

    it('should reject too many files', async () => {
      // Arrange
      const tooManyFiles = Array.from({ length: 51 }, (_, i) => 
        createMockFile({ name: `file${i}.txt`, size: 1024 })
      )

      // Act & Assert
      await expect(service.uploadBatch(tooManyFiles, userId)).rejects.toThrow('Batch upload limited to 50 files maximum')
    })
  })

  describe('getUploadStatus', () => {
    it('should return upload status', async () => {
      // Arrange
      const uploadId = 'test-upload-id'
      const expectedStatus = {
        status: 'completed' as const,
        progress: 100
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: expectedStatus
        })
      })

      // Act
      const result = await service.getUploadStatus(uploadId)

      // Assert
      expect(result).toEqual(expectedStatus)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/upload/status/test-upload-id',
        expect.objectContaining({
          method: 'GET'
        })
      )
    })

    it('should handle status check errors', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Status check failed'))

      // Act & Assert
      await expect(service.getUploadStatus('test-id')).rejects.toThrow('Status check failed')
    })
  })

  describe('cancelUpload', () => {
    it('should cancel upload', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      // Act
      await service.cancelUpload('test-upload-id')

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/upload/cancel/test-upload-id',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      // Act
      await service.deleteFile('test-file-id')

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/files/test-file-id',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })
  })

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      // Arrange
      const expectedMetadata = {
        id: 'test-file-id',
        url: 'test-url',
        path: 'test-path',
        size: 1024,
        type: 'image/jpeg',
        uploadedAt: '2024-01-01T00:00:00Z'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: expectedMetadata
        })
      })

      // Act
      const result = await service.getFileMetadata('test-file-id')

      // Assert
      expect(result).toEqual(expectedMetadata)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/files/test-file-id',
        expect.objectContaining({
          method: 'GET'
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      // Act & Assert
      await expect(service.uploadBatch([mockFile], userId)).rejects.toThrow('HTTP 500: Internal Server Error')
    })

    it('should handle request timeout', async () => {
      // Arrange
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100)
        })
      )

      // Act & Assert
      await expect(service.uploadBatch([mockFile], userId, { timeout: 50 })).rejects.toThrow('Request timeout')
    })
  })

  describe('file validation', () => {
    it('should accept supported file types', () => {
      const supportedFiles = [
        createMockFile({ name: 'image.jpg', type: 'image/jpeg' }),
        createMockFile({ name: 'document.pdf', type: 'application/pdf' }),
        createMockFile({ name: 'data.json', type: 'application/json' }),
        createMockFile({ name: 'archive.zip', type: 'application/zip' })
      ]

      // Should not throw for any of these
      supportedFiles.forEach(file => {
        expect(() => service['validateFile'](file)).not.toThrow()
      })
    })

    it('should warn about unsupported file types', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const unsupportedFile = createMockFile({ 
        name: 'executable.exe', 
        type: 'application/x-msdownload' 
      })

      service['validateFile'](unsupportedFile)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File type application/x-msdownload may not be supported')
      )
      consoleSpy.mockRestore()
    })
  })
})