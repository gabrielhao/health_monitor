import { processAndStoreXML } from '../utils/xmlProcessor'

export interface ChunkUploadOptions {
  chunkSize?: number
  maxRetries?: number
  timeout?: number
  onProgress?: (progress: number) => void
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
  userId?: string
  documentId?: string
  metadata?: Record<string, any>
}

interface ProcessingSession {
  id: string
  fileName: string
  fileSize: number
  totalChunks: number
  processedChunks: Set<number>
  createdAt: Date
  fileContent?: string
}

/**
 * Service for processing large XML files in chunks with streaming support.
 * Handles buffer management to ensure complete XML records are extracted
 * while preserving incomplete records for the next chunk.
 */
class ChunkUploadService {
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  private static readonly MAX_RETRIES = 3
  private static readonly TIMEOUT = 30000 // 30 seconds per chunk
  private static readonly BUFFER_SIZE = 64 * 1024 // 64KB read buffer
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
  private static readonly CLOSING_TAG_LENGTH = 9 // length of '</Record>'
  private static readonly EXPONENTIAL_BACKOFF_BASE = 2
  private static readonly BACKOFF_BASE_DELAY = 1000 // 1 second
  
  private sessions = new Map<string, ProcessingSession>()

  /**
   * Processes an XML file by streaming it in chunks and extracting complete records.
   * Ensures buffer management to handle incomplete records between chunks.
   * 
   * @param file - The XML file to process
   * @param userId - The user ID for processing context
   * @param options - Configuration options for chunk processing
   * @returns Promise that resolves to the session ID
   * @throws Error if file validation fails or processing encounters errors
   */
  async processXMLFile(
    file: File,
    userId: string,
    options: ChunkUploadOptions = {}
  ): Promise<string> {
    console.log(`[ChunkUpload] Starting to process file: ${file.name}, size: ${file.size} bytes`)
    
    // Input validation
    if (!file) {
      throw new Error('File is required')
    }
    
    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID is required and cannot be empty')
    }
    
    if (file.size === 0) {
      throw new Error('File is empty')
    }
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xml')) {
      throw new Error('Only XML files are supported')
    }

    const {
      chunkSize = ChunkUploadService.DEFAULT_CHUNK_SIZE,
      maxRetries = ChunkUploadService.MAX_RETRIES,
      timeout = ChunkUploadService.TIMEOUT,
      onProgress,
      onChunkComplete,
      documentId = this.generateSessionId(),
      metadata = {}
    } = options

    // Validate options
    if (chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0')
    }
    
    if (maxRetries < 0) {
      throw new Error('Max retries cannot be negative')
    }
    
    if (timeout <= 0) {
      throw new Error('Timeout must be greater than 0')
    }

    // Validate file size (5GB limit)
    if (file.size > ChunkUploadService.MAX_FILE_SIZE) {
      throw new Error('File size exceeds 5GB limit')
    }

    // Create processing session
    const sessionId = this.generateSessionId()
    console.log(`[ChunkUpload] Created new session: ${sessionId}`)
    
    const session: ProcessingSession = {
      id: sessionId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks: 0,
      processedChunks: new Set(),
      createdAt: new Date()
    }
    
    this.sessions.set(sessionId, session)

    try {
      await this.processFileStream(file, session, userId, documentId, metadata, chunkSize, maxRetries, timeout, onProgress, onChunkComplete)
      this.sessions.delete(sessionId)
      return sessionId
    } catch (error) {
      throw error
    }
  }

  private async processFileStream(
    file: File,
    session: ProcessingSession,
    userId: string,
    documentId: string,
    metadata: Record<string, any>,
    chunkSize: number,
    maxRetries: number,
    timeout: number,
    onProgress?: (progress: number) => void,
    onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
  ): Promise<void> {
    console.log('[ChunkUpload] Starting streaming file processing...')
    
    const reader = file.stream().getReader()
    const decoder = new TextDecoder()
    
    let buffer = ''
    let currentRecords: string[] = []
    let chunkIndex = 0
    let totalRecords = 0
    let bytesProcessed = 0
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('[ChunkUpload] Reached end of file stream')
          // Process final chunk if it has records
          if (currentRecords.length > 0) {
            console.log(`[ChunkUpload] Processing final chunk with ${currentRecords.length} records`)
            await this.processRecordChunk(currentRecords, chunkIndex, session, userId, documentId, metadata, maxRetries, timeout)
            chunkIndex++
          }
          break
        }
        
        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        bytesProcessed += value.length
        
        const processResult = await this.processBufferChunk(
          buffer, 
          currentRecords, 
          chunkSize, 
          chunkIndex, 
          totalRecords, 
          bytesProcessed, 
          file.size, 
          session, 
          userId, 
          documentId, 
          metadata, 
          maxRetries, 
          timeout, 
          onProgress, 
          onChunkComplete
        )
        
        buffer = processResult.remainingBuffer
        currentRecords = processResult.currentRecords
        chunkIndex = processResult.chunkIndex
        totalRecords = processResult.totalRecords
      }
      
      session.totalChunks = chunkIndex
      console.log(`[ChunkUpload] Completed processing ${totalRecords} records in ${chunkIndex} chunks`)
      
    } finally {
      reader.releaseLock()
    }
  }

  private async processBufferChunk(
    buffer: string,
    currentRecords: string[],
    chunkSize: number,
    chunkIndex: number,
    totalRecords: number,
    bytesProcessed: number,
    fileSize: number,
    session: ProcessingSession,
    userId: string,
    documentId: string,
    metadata: Record<string, any>,
    maxRetries: number,
    timeout: number,
    onProgress?: (progress: number) => void,
    onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
  ): Promise<{
    remainingBuffer: string,
    currentRecords: string[],
    chunkIndex: number,
    totalRecords: number
  }> {
    // Extract complete records from buffer
    const { records, remainingBuffer } = this.extractRecords(buffer)
    
    if (records.length > 0) {
      currentRecords.push(...records)
      totalRecords += records.length
      
      console.log(`[ChunkUpload] Found ${records.length} records, total: ${totalRecords}, buffer: ${bytesProcessed} bytes`)
      
      // Check if we have enough records to form a chunk
      const currentChunkSize = currentRecords.join('').length
      if (currentChunkSize >= chunkSize && currentRecords.length > 0) {
        console.log(`[ChunkUpload] Processing chunk ${chunkIndex} with ${currentRecords.length} records (${currentChunkSize} chars)`)
        
        await this.processRecordChunk(currentRecords, chunkIndex, session, userId, documentId, metadata, maxRetries, timeout)
        
        // Update progress
        const progress = (bytesProcessed / fileSize) * 100
        console.log(`[ChunkUpload] Progress: ${progress.toFixed(2)}%`)
        onProgress?.(progress)
        onChunkComplete?.(chunkIndex, Math.ceil(fileSize / chunkSize))
        
        chunkIndex++
        currentRecords = [] // Reset for next chunk
      }
    }
    
    return {
      remainingBuffer,
      currentRecords,
      chunkIndex,
      totalRecords
    }
  }

  /**
   * Extracts complete XML records from a buffer while preserving incomplete records.
   * Handles self-closing Record tags in the format: <Record .... />
   * This is the core method that ensures proper XML chunk processing.
   * 
   * @param buffer - The string buffer containing XML data
   * @returns Object containing extracted records and remaining buffer
   */
  private extractRecords(buffer: string): { records: string[], remainingBuffer: string } {
    const records: string[] = []
    let currentPosition = 0
    let lastRecordEndPosition = 0
    
    // Early return for empty buffer
    if (!buffer || buffer.length === 0) {
      return { records: [], remainingBuffer: '' }
    }
    
    while (currentPosition < buffer.length) {
      // Look for record start - use more specific pattern
      const recordStartPosition = buffer.indexOf('<Record', currentPosition)
      if (recordStartPosition === -1) {
        break // No more records
      }
      
      // Ensure we found a valid tag start (not just substring match)
      const nextChar = buffer.charAt(recordStartPosition + 7) // 7 = length of '<Record'
      if (nextChar !== ' ' && nextChar !== '>' && nextChar !== '/') {
        currentPosition = recordStartPosition + 1
        continue // Skip false matches like '<RecordXXX'
      }
      
      // Look for the closing '/>' of the self-closing tag
      const recordEndPosition = buffer.indexOf('/>', recordStartPosition)
      if (recordEndPosition === -1) {
        break // Incomplete record - missing closing '/>'
      }
      
      // Extract complete record
      const record = buffer.substring(recordStartPosition, recordEndPosition + 2)
      records.push(record)
      
      lastRecordEndPosition = recordEndPosition + 2
      currentPosition = lastRecordEndPosition
    }
    
    const remainingBuffer = buffer.substring(lastRecordEndPosition)
    
    if (records.length > 0) {
      console.log(`[ChunkUpload] Extracted ${records.length} records, ${remainingBuffer.length} chars remaining`)
    }
    
    return { records, remainingBuffer }
  }

  private async processRecordChunk(
    records: string[],
    chunkIndex: number,
    session: ProcessingSession,
    userId: string,
    documentId: string,
    metadata: Record<string, any>,
    maxRetries: number,
    timeout: number
  ): Promise<void> {
    // Create a simple XML wrapper for the records
    const xmlContent = `${records.join('\n')}`


    await this.processChunkWithRetry(
      xmlContent,
      chunkIndex,
      session,
      userId,
      documentId,
      metadata,
      maxRetries,
      timeout
    )
    
    session.processedChunks.add(chunkIndex)
  }

  private async processChunkWithRetry(
    chunkContent: string,
    chunkIndex: number,
    session: ProcessingSession,
    userId: string,
    documentId: string,
    metadata: Record<string, any>,
    maxRetries: number,
    timeout: number
  ): Promise<void> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ChunkUpload] Processing chunk ${chunkIndex}, attempt ${attempt + 1}/${maxRetries + 1}`)
        await this.processSingleChunk(
          chunkContent,
          chunkIndex,
          session,
          userId,
          documentId,
          metadata,
          timeout
        )
        console.log(`[ChunkUpload] Successfully processed chunk ${chunkIndex}`)
        return
      } catch (error) {
        lastError = error as Error
        console.warn(`[ChunkUpload] Chunk ${chunkIndex} processing attempt ${attempt + 1} failed:`, error)
        
        if (attempt < maxRetries) {
          const delay = Math.pow(ChunkUploadService.EXPONENTIAL_BACKOFF_BASE, attempt) * ChunkUploadService.BACKOFF_BASE_DELAY
          console.log(`[ChunkUpload] Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    console.error(`[ChunkUpload] Failed to process chunk ${chunkIndex} after ${maxRetries + 1} attempts:`, lastError)
    throw new Error(`Failed to process chunk ${chunkIndex} after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

  private async processSingleChunk(
    chunkContent: string,
    chunkIndex: number,
    session: ProcessingSession,
    userId: string,
    documentId: string,
    metadata: Record<string, any>,
    timeout: number
  ): Promise<void> {
    console.log(`[ChunkUpload] Starting single chunk processing for chunk ${chunkIndex}`)
    
    // Debug the chunk content
    console.log(`[ChunkUpload] Chunk ${chunkIndex} content length: ${chunkContent?.length || 'undefined'}`)
    
    // Validate chunk content
    if (!chunkContent || chunkContent.trim().length === 0) {
      throw new Error(`Chunk ${chunkIndex} is empty or undefined`)
    }
    
    // Count records in chunk
    const recordCount = (chunkContent.match(/<Record/g) || []).length
    console.log(`[ChunkUpload] Chunk ${chunkIndex} contains ${recordCount} records`)
    
    if (recordCount === 0) {
      console.warn(`[ChunkUpload] Chunk ${chunkIndex} contains no records, skipping...`)
      return
    }
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error(`[ChunkUpload] Chunk ${chunkIndex} processing timed out after ${timeout}ms`)
        reject(new Error('Chunk processing timeout'))
      }, timeout)
    })
    

    // Process chunk and store embedding
    const processPromise = processAndStoreXML(chunkContent, userId, documentId, {
      ...metadata,
      chunkIndex,
      fileName: session.fileName,
      sessionId: session.id
    })
    
    await Promise.race([processPromise, timeoutPromise])
    console.log(`[ChunkUpload] Completed processing chunk ${chunkIndex}`)
  }

  private generateSessionId(): string {
    return `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getProcessingProgress(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    if (!session) return 0
    
    return (session.processedChunks.size / session.totalChunks) * 100
  }

  getActiveSessions(): ProcessingSession[] {
    return Array.from(this.sessions.values())
  }

  async cancelProcessing(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Processing session not found')
    }

    // Cleanup session
    this.sessions.delete(sessionId)
  }
}

export const chunkUploadService = new ChunkUploadService()

export { ChunkUploadService }