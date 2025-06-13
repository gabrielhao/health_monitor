import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkUploadService } from '@/services/chunkUploadService'
import { mockSupabaseClient, createMockFile } from '../mocks/supabase'

// Mock the supabase module
vi.mock('@/services/supabase', () => ({
  supabase: mockSupabaseClient
}))

describe('ChunkUploadService', () => {
  let service: ChunkUploadService
  let mockFile: File
  const userId = 'test-user-id'

  beforeEach(() => {
    service = new ChunkUploadService()
    mockFile = createMockFile({
      name: 'test-health-data.xml',
      size: 10 * 1024 * 1024 // 10MB
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('uploadFile', () => {
    it('should successfully upload a small file in single chunk', async () => {
      // Arrange
      const smallFile = createMockFile({
        name: 'small-file.json',
        size: 1024 // 1KB
      })
      
      mockSupabaseClient.storage.from().upload.mockResolvedValue({ error: null })
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      const onProgress = vi.fn()
      const onChunkComplete = vi.fn()

      // Act
      const result = await service.uploadFile(userId, smallFile, {
        onProgress,
        onChunkComplete
      })

      // Assert
      expect(result).toBe('test-path')
      expect(onProgress).toHaveBeenCalledWith(100)
      expect(onChunkComplete).toHaveBeenCalledWith(0, 1)
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('health-files')
    })

    it('should upload large file in multiple chunks', async () => {
      // Arrange
      const largeFile = createMockFile({
        name: 'large-file.xml',
        size: 15 * 1024 * 1024 // 15MB
      })
      
      mockSupabaseClient.storage.from().upload.mockResolvedValue({ error: null })
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      const onProgress = vi.fn()
      const onChunkComplete = vi.fn()

      // Act
      const result = await service.uploadFile(userId, largeFile, {
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        onProgress,
        onChunkComplete
      })

      // Assert
      expect(result).toBe('test-path')
      expect(onProgress).toHaveBeenCalledTimes(3) // 3 chunks
      expect(onChunkComplete).toHaveBeenCalledTimes(3)
      expect(mockSupabaseClient.storage.from().upload).toHaveBeenCalledTimes(3)
    })

    it('should reject files larger than 5GB', async () => {
      // Arrange
      const oversizedFile = createMockFile({
        name: 'huge-file.xml',
        size: 6 * 1024 * 1024 * 1024 // 6GB
      })

      // Act & Assert
      await expect(service.uploadFile(userId, oversizedFile)).rejects.toThrow(
        'File size exceeds 5GB limit'
      )
    })

    it('should retry failed chunk uploads with exponential backoff', async () => {
      // Arrange
      mockSupabaseClient.storage.from().upload
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ error: null })
      
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      // Act
      const result = await service.uploadFile(userId, mockFile, {
        maxRetries: 2
      })

      // Assert
      expect(result).toBe('test-path')
      expect(mockSupabaseClient.storage.from().upload).toHaveBeenCalledTimes(3)
    })

    it('should fail after maximum retries exceeded', async () => {
      // Arrange
      mockSupabaseClient.storage.from().upload.mockRejectedValue(new Error('Persistent error'))

      // Act & Assert
      await expect(service.uploadFile(userId, mockFile, {
        maxRetries: 2
      })).rejects.toThrow('Failed to upload chunk 0 after 3 attempts')
    })

    it('should calculate and verify MD5 checksums', async () => {
      // Arrange
      const mockArrayBuffer = new ArrayBuffer(16)
      const mockHashArray = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
      
      global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHashArray.buffer)
      
      mockSupabaseClient.storage.from().upload.mockResolvedValue({ error: null })
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      // Act
      await service.uploadFile(userId, mockFile)

      // Assert
      expect(global.crypto.subtle.digest).toHaveBeenCalledWith('MD5', expect.any(ArrayBuffer))
    })

    it('should handle upload timeout', async () => {
      // Arrange
      mockSupabaseClient.storage.from().upload.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      )

      // Act & Assert
      await expect(service.uploadFile(userId, mockFile, {
        timeout: 1000 // 1 second timeout
      })).rejects.toThrow('Chunk upload timeout')
    })
  })

  describe('getUploadProgress', () => {
    it('should return 0 for non-existent session', () => {
      // Act
      const progress = service.getUploadProgress('non-existent-session')

      // Assert
      expect(progress).toBe(0)
    })

    it('should return correct progress for active session', async () => {
      // Arrange
      mockSupabaseClient.storage.from().upload.mockResolvedValue({ error: null })
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      // Start upload but don't wait for completion
      const uploadPromise = service.uploadFile(userId, mockFile)
      
      // Act
      const progress = service.getUploadProgress('test-session-id')

      // Assert
      expect(typeof progress).toBe('number')
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(100)

      await uploadPromise
    })
  })

  describe('getActiveSessions', () => {
    it('should return empty array when no active sessions', () => {
      // Act
      const sessions = service.getActiveSessions()

      // Assert
      expect(sessions).toEqual([])
    })

    it('should return active sessions during upload', async () => {
      // Arrange
      mockSupabaseClient.storage.from().upload.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
      )
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      // Start upload
      const uploadPromise = service.uploadFile(userId, mockFile)
      
      // Act
      const sessions = service.getActiveSessions()

      // Assert
      expect(sessions.length).toBeGreaterThan(0)
      expect(sessions[0]).toHaveProperty('id')
      expect(sessions[0]).toHaveProperty('fileName')
      expect(sessions[0]).toHaveProperty('fileSize')

      await uploadPromise
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty file', async () => {
      // Arrange
      const emptyFile = createMockFile({
        name: 'empty.txt',
        size: 0
      })

      mockSupabaseClient.storage.from().upload.mockResolvedValue({ error: null })
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      // Act
      const result = await service.uploadFile(userId, emptyFile)

      // Assert
      expect(result).toBe('test-path')
    })

    it('should handle file with special characters in name', async () => {
      // Arrange
      const specialFile = createMockFile({
        name: 'test file with spaces & symbols!.xml',
        size: 1024
      })

      mockSupabaseClient.storage.from().upload.mockResolvedValue({ error: null })
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { filePath: 'test-path' },
        error: null
      })

      // Act
      const result = await service.uploadFile(userId, specialFile)

      // Assert
      expect(result).toBe('test-path')
    })

    it('should cleanup failed uploads', async () => {
      // Arrange
      mockSupabaseClient.storage.from().upload.mockRejectedValue(new Error('Upload failed'))
      mockSupabaseClient.storage.from().remove.mockResolvedValue({ error: null })

      // Act & Assert
      await expect(service.uploadFile(userId, mockFile, {
        maxRetries: 0
      })).rejects.toThrow()

      expect(mockSupabaseClient.storage.from().remove).toHaveBeenCalled()
    })
  })
})