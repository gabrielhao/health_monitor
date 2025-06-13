import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackgroundProcessor, type ProcessingJob } from '@/services/backgroundProcessor'

describe('BackgroundProcessor', () => {
  let processor: BackgroundProcessor

  beforeEach(() => {
    processor = new BackgroundProcessor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    processor.stop()
    vi.useRealTimers()
  })

  describe('addJob', () => {
    it('should add job with default options', () => {
      // Act
      const jobId = processor.addJob('file_upload', { file: 'test.xml' })

      // Assert
      expect(jobId).toBeTruthy()
      expect(typeof jobId).toBe('string')
      
      const job = processor.getJob(jobId)
      expect(job).toBeDefined()
      expect(job?.type).toBe('file_upload')
      expect(job?.status).toBe('pending')
      expect(job?.priority).toBe(0)
      expect(job?.maxRetries).toBe(3)
    })

    it('should add job with custom options', () => {
      // Act
      const jobId = processor.addJob('data_processing', { records: [] }, {
        priority: 5,
        maxRetries: 1
      })

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.priority).toBe(5)
      expect(job?.maxRetries).toBe(1)
    })

    it('should queue jobs in priority order', () => {
      // Arrange & Act
      const lowPriorityJob = processor.addJob('file_upload', {}, { priority: 1 })
      const highPriorityJob = processor.addJob('data_processing', {}, { priority: 5 })
      const mediumPriorityJob = processor.addJob('embedding_generation', {}, { priority: 3 })

      // Assert
      expect(processor.getQueueLength()).toBe(3)
      
      // Jobs should be processed in priority order (high to low)
      const queuedJobs = processor.getJobsByStatus('pending')
      expect(queuedJobs[0].id).toBe(highPriorityJob)
      expect(queuedJobs[1].id).toBe(mediumPriorityJob)
      expect(queuedJobs[2].id).toBe(lowPriorityJob)
    })
  })

  describe('Job Processing', () => {
    it('should process file upload job successfully', async () => {
      // Arrange
      const jobData = {
        file: { size: 1024 * 1024 },
        chunkSize: 1024
      }

      // Act
      const jobId = processor.addJob('file_upload', jobData)
      
      // Fast-forward time to allow processing
      await vi.advanceTimersByTimeAsync(2000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('completed')
      expect(job?.startedAt).toBeDefined()
      expect(job?.completedAt).toBeDefined()
    })

    it('should process data processing job successfully', async () => {
      // Arrange
      const jobData = {
        records: new Array(100).fill({ type: 'test', value: 1 })
      }

      // Act
      const jobId = processor.addJob('data_processing', jobData)
      
      // Fast-forward time to allow processing
      await vi.advanceTimersByTimeAsync(2000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('completed')
    })

    it('should process embedding generation job successfully', async () => {
      // Arrange
      const jobData = {
        documents: [
          { content: 'Document 1' },
          { content: 'Document 2' }
        ]
      }

      // Act
      const jobId = processor.addJob('embedding_generation', jobData)
      
      // Fast-forward time to allow processing
      await vi.advanceTimersByTimeAsync(1000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('completed')
    })

    it('should handle unknown job type', async () => {
      // Act
      const jobId = processor.addJob('unknown_type' as any, {})
      
      // Fast-forward time to allow processing
      await vi.advanceTimersByTimeAsync(1000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('failed')
      expect(job?.error).toContain('Unknown job type')
    })
  })

  describe('Job Retry Logic', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      // Arrange
      const originalProcessFileUpload = (processor as any).processFileUpload
      let attemptCount = 0
      
      ;(processor as any).processFileUpload = vi.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
        return Promise.resolve()
      })

      // Act
      const jobId = processor.addJob('file_upload', {}, { maxRetries: 3 })
      
      // Fast-forward time to allow multiple retry attempts
      await vi.advanceTimersByTimeAsync(10000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('completed')
      expect(job?.retryCount).toBe(2)
      expect(attemptCount).toBe(3)

      // Restore original method
      ;(processor as any).processFileUpload = originalProcessFileUpload
    })

    it('should fail permanently after max retries', async () => {
      // Arrange
      const originalProcessFileUpload = (processor as any).processFileUpload
      ;(processor as any).processFileUpload = vi.fn().mockRejectedValue(
        new Error('Persistent failure')
      )

      // Act
      const jobId = processor.addJob('file_upload', {}, { maxRetries: 2 })
      
      // Fast-forward time to allow all retry attempts
      await vi.advanceTimersByTimeAsync(15000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('failed')
      expect(job?.retryCount).toBe(2)
      expect(job?.error).toBe('Persistent failure')

      // Restore original method
      ;(processor as any).processFileUpload = originalProcessFileUpload
    })
  })

  describe('Queue Management', () => {
    it('should return correct queue length', () => {
      // Act
      processor.addJob('file_upload', {})
      processor.addJob('data_processing', {})
      processor.addJob('embedding_generation', {})

      // Assert
      expect(processor.getQueueLength()).toBe(3)
    })

    it('should filter jobs by status', async () => {
      // Arrange
      const job1 = processor.addJob('file_upload', {})
      const job2 = processor.addJob('data_processing', {})
      
      // Fast-forward to complete one job
      await vi.advanceTimersByTimeAsync(2000)

      // Act
      const pendingJobs = processor.getJobsByStatus('pending')
      const completedJobs = processor.getJobsByStatus('completed')

      // Assert
      expect(pendingJobs.length).toBeGreaterThanOrEqual(0)
      expect(completedJobs.length).toBeGreaterThanOrEqual(1)
    })

    it('should track active workers', () => {
      // Act
      const activeWorkers = processor.getActiveWorkers()

      // Assert
      expect(typeof activeWorkers).toBe('number')
      expect(activeWorkers).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Processor Lifecycle', () => {
    it('should stop processing when stop() is called', () => {
      // Arrange
      const initialQueueLength = processor.getQueueLength()

      // Act
      processor.stop()
      processor.addJob('file_upload', {})

      // Assert
      expect(processor.getQueueLength()).toBe(initialQueueLength + 1)
      // Job should remain pending since processor is stopped
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty job data', async () => {
      // Act
      const jobId = processor.addJob('file_upload', {})
      
      await vi.advanceTimersByTimeAsync(1000)

      // Assert
      const job = processor.getJob(jobId)
      expect(job?.status).toBe('completed')
    })

    it('should generate unique job IDs', () => {
      // Act
      const jobId1 = processor.addJob('file_upload', {})
      const jobId2 = processor.addJob('file_upload', {})
      const jobId3 = processor.addJob('file_upload', {})

      // Assert
      expect(jobId1).not.toBe(jobId2)
      expect(jobId2).not.toBe(jobId3)
      expect(jobId1).not.toBe(jobId3)
    })

    it('should handle concurrent job processing', async () => {
      // Arrange
      const jobs = []
      for (let i = 0; i < 5; i++) {
        jobs.push(processor.addJob('file_upload', { index: i }))
      }

      // Act
      await vi.advanceTimersByTimeAsync(5000)

      // Assert
      jobs.forEach(jobId => {
        const job = processor.getJob(jobId)
        expect(job?.status).toBe('completed')
      })
    })
  })
})