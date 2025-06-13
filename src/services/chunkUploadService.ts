import { supabase } from './supabase'

export interface ChunkUploadOptions {
  chunkSize?: number
  maxRetries?: number
  timeout?: number
  onProgress?: (progress: number) => void
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
}

export interface UploadSession {
  id: string
  fileName: string
  fileSize: number
  totalChunks: number
  uploadedChunks: Set<number>
  checksum: string
  createdAt: Date
}

export class ChunkUploadService {
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  private static readonly MAX_RETRIES = 3
  private static readonly TIMEOUT = 30000 // 30 seconds per chunk
  
  private sessions = new Map<string, UploadSession>()

  async uploadFile(
    file: File,
    userId: string,
    options: ChunkUploadOptions = {}
  ): Promise<string> {
    const {
      chunkSize = ChunkUploadService.DEFAULT_CHUNK_SIZE,
      maxRetries = ChunkUploadService.MAX_RETRIES,
      timeout = ChunkUploadService.TIMEOUT,
      onProgress,
      onChunkComplete
    } = options

    // Calculate file checksum
    const fileChecksum = await this.calculateMD5(file)
    
    // Create upload session
    const sessionId = this.generateSessionId()
    const totalChunks = Math.ceil(file.size / chunkSize)
    const fileName = `${userId}/${sessionId}/${file.name}`
    
    const session: UploadSession = {
      id: sessionId,
      fileName,
      fileSize: file.size,
      totalChunks,
      uploadedChunks: new Set(),
      checksum: fileChecksum,
      createdAt: new Date()
    }
    
    this.sessions.set(sessionId, session)

    try {
      // Upload chunks with retry logic
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (session.uploadedChunks.has(chunkIndex)) {
          continue // Skip already uploaded chunks (resumable)
        }

        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)
        
        await this.uploadChunkWithRetry(
          chunk,
          chunkIndex,
          session,
          maxRetries,
          timeout
        )
        
        session.uploadedChunks.add(chunkIndex)
        
        // Progress callback
        const progress = (session.uploadedChunks.size / totalChunks) * 100
        onProgress?.(progress)
        onChunkComplete?.(chunkIndex, totalChunks)
      }

      // Verify all chunks uploaded
      if (session.uploadedChunks.size !== totalChunks) {
        throw new Error('Not all chunks were uploaded successfully')
      }

      // Combine chunks on server
      const finalPath = await this.combineChunks(session)
      
      // Cleanup session
      this.sessions.delete(sessionId)
      
      return finalPath

    } catch (error) {
      // Cleanup on failure
      await this.cleanupFailedUpload(session)
      throw error
    }
  }

  async resumeUpload(sessionId: string, options: ChunkUploadOptions = {}): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Upload session not found')
    }

    // Continue from where we left off
    const remainingChunks = session.totalChunks - session.uploadedChunks.size
    console.log(`Resuming upload: ${remainingChunks} chunks remaining`)
    
    // This would continue the upload process...
    // Implementation would be similar to uploadFile but starting from unuploaded chunks
    throw new Error('Resume functionality not yet implemented')
  }

  private async uploadChunkWithRetry(
    chunk: Blob,
    chunkIndex: number,
    session: UploadSession,
    maxRetries: number,
    timeout: number
  ): Promise<void> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.uploadSingleChunk(chunk, chunkIndex, session, timeout)
        return // Success
      } catch (error) {
        lastError = error as Error
        console.warn(`Chunk ${chunkIndex} upload attempt ${attempt + 1} failed:`, error)
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw new Error(`Failed to upload chunk ${chunkIndex} after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

  private async uploadSingleChunk(
    chunk: Blob,
    chunkIndex: number,
    session: UploadSession,
    timeout: number
  ): Promise<void> {
    const chunkChecksum = await this.calculateMD5(chunk)
    const chunkPath = `${session.fileName}.chunk.${chunkIndex}`
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Chunk upload timeout')), timeout)
    })
    
    // Upload chunk with metadata
    const uploadPromise = supabase.storage
      .from('health-files')
      .upload(chunkPath, chunk, {
        metadata: {
          chunkIndex: chunkIndex.toString(),
          chunkChecksum,
          sessionId: session.id,
          totalChunks: session.totalChunks.toString()
        }
      })
    
    const { error } = await Promise.race([uploadPromise, timeoutPromise])
    
    if (error) {
      throw new Error(`Chunk upload failed: ${error.message}`)
    }
  }

  private async combineChunks(session: UploadSession): Promise<string> {
    // Call edge function to combine chunks on server
    const { data, error } = await supabase.functions.invoke('combine-chunks', {
      body: {
        sessionId: session.id,
        fileName: session.fileName,
        totalChunks: session.totalChunks,
        expectedChecksum: session.checksum
      }
    })

    if (error) {
      throw new Error(`Failed to combine chunks: ${error.message}`)
    }

    return data.filePath
  }

  private async cleanupFailedUpload(session: UploadSession): Promise<void> {
    try {
      // Remove uploaded chunks
      const chunkPaths = Array.from(session.uploadedChunks).map(
        index => `${session.fileName}.chunk.${index}`
      )
      
      if (chunkPaths.length > 0) {
        await supabase.storage
          .from('health-files')
          .remove(chunkPaths)
      }
    } catch (error) {
      console.error('Failed to cleanup chunks:', error)
    }
    
    this.sessions.delete(session.id)
  }

  private async calculateMD5(data: Blob): Promise<string> {
    const arrayBuffer = await data.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('MD5', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private generateSessionId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getUploadProgress(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    if (!session) return 0
    
    return (session.uploadedChunks.size / session.totalChunks) * 100
  }

  getActiveSessions(): UploadSession[] {
    return Array.from(this.sessions.values())
  }
}

export const chunkUploadService = new ChunkUploadService()