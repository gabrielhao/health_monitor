export interface ProcessingJob {
  id: string
  type: 'file_upload' | 'data_processing' | 'embedding_generation'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  data: any
  priority: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
  retryCount: number
  maxRetries: number
}

export class BackgroundProcessor {
  private jobs = new Map<string, ProcessingJob>()
  private processing = false
  private workers: Worker[] = []
  private maxWorkers = 2
  private processingQueue: ProcessingJob[] = []

  constructor() {
    this.startProcessing()
  }

  addJob(
    type: ProcessingJob['type'],
    data: any,
    options: {
      priority?: number
      maxRetries?: number
    } = {}
  ): string {
    const job: ProcessingJob = {
      id: this.generateJobId(),
      type,
      status: 'pending',
      data,
      priority: options.priority || 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3
    }

    this.jobs.set(job.id, job)
    this.queueJob(job)
    
    return job.id
  }

  private queueJob(job: ProcessingJob) {
    // Insert job in priority order
    const insertIndex = this.processingQueue.findIndex(
      queuedJob => queuedJob.priority < job.priority
    )
    
    if (insertIndex === -1) {
      this.processingQueue.push(job)
    } else {
      this.processingQueue.splice(insertIndex, 0, job)
    }
  }

  private async startProcessing() {
    this.processing = true
    
    while (this.processing) {
      if (this.processingQueue.length > 0 && this.workers.length < this.maxWorkers) {
        const job = this.processingQueue.shift()!
        this.processJob(job)
      }
      
      // Check every 100ms
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  private async processJob(job: ProcessingJob) {
    try {
      job.status = 'processing'
      job.startedAt = new Date()
      
      console.log(`Processing job ${job.id} of type ${job.type}`)
      
      switch (job.type) {
        case 'file_upload':
          await this.processFileUpload(job)
          break
        case 'data_processing':
          await this.processData(job)
          break
        case 'embedding_generation':
          await this.generateEmbeddings(job)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }
      
      job.status = 'completed'
      job.completedAt = new Date()
      
      console.log(`Job ${job.id} completed successfully`)
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error)
      
      job.error = error instanceof Error ? error.message : 'Unknown error'
      
      if (job.retryCount < job.maxRetries) {
        job.retryCount++
        job.status = 'pending'
        
        // Exponential backoff for retries
        const delay = Math.pow(2, job.retryCount) * 1000
        setTimeout(() => {
          this.queueJob(job)
        }, delay)
        
        console.log(`Job ${job.id} will retry in ${delay}ms (attempt ${job.retryCount}/${job.maxRetries})`)
      } else {
        job.status = 'failed'
        job.completedAt = new Date()
        console.error(`Job ${job.id} failed permanently after ${job.maxRetries} retries`)
      }
    }
  }

  private async processFileUpload(job: ProcessingJob) {
    // Simulate file upload processing
    const { file, chunkSize } = job.data
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    for (let i = 0; i < totalChunks; i++) {
      // Simulate chunk processing time
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Update progress
      const progress = ((i + 1) / totalChunks) * 100
      console.log(`File upload progress: ${progress}%`)
    }
  }

  private async processData(job: ProcessingJob) {
    // Simulate data processing
    const { records } = job.data
    
    for (let i = 0; i < records.length; i++) {
      // Simulate record processing
      await new Promise(resolve => setTimeout(resolve, 10))
      
      if (i % 100 === 0) {
        const progress = ((i + 1) / records.length) * 100
        console.log(`Data processing progress: ${progress}%`)
      }
    }
  }

  private async generateEmbeddings(job: ProcessingJob) {
    // Simulate embedding generation
    const { documents } = job.data
    
    for (let i = 0; i < documents.length; i++) {
      // Simulate embedding generation time
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const progress = ((i + 1) / documents.length) * 100
      console.log(`Embedding generation progress: ${progress}%`)
    }
  }

  getJob(id: string): ProcessingJob | undefined {
    return this.jobs.get(id)
  }

  getJobsByStatus(status: ProcessingJob['status']): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status)
  }

  getQueueLength(): number {
    return this.processingQueue.length
  }

  getActiveWorkers(): number {
    return this.workers.length
  }

  stop() {
    this.processing = false
    this.workers.forEach(worker => worker.terminate())
    this.workers = []
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const backgroundProcessor = new BackgroundProcessor()