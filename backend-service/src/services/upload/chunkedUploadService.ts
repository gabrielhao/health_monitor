import { azureBlobService } from '../../shared/services/azureBlobService.js'
import type { ChunkedUploadInitResponse, ChunkedUploadStatus } from '../../shared/types/index.js'

interface ChunkedUploadSession {
  sessionId: string
  userId: string
  fileName: string
  contentType: string
  totalChunks: number
  chunkSize: number
  uploadedChunks: Map<number, Buffer>
  metadata: Record<string, string>
  createdAt: Date
  expiresAt: Date
}

export class ChunkedUploadService {
  private sessions: Map<string, ChunkedUploadSession> = new Map()
  private readonly sessionTimeout = 24 * 60 * 60 * 1000 // 24 hours

  constructor() {
    // Clean up expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000)
  }

  async initializeChunkedUpload(
    userId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
    chunkSize: number = 5 * 1024 * 1024, // 5MB default
    metadata: Record<string, string> = {}
  ): Promise<ChunkedUploadInitResponse> {
    const sessionId = this.generateSessionId()
    const totalChunks = Math.ceil(fileSize / chunkSize)
    const expiresAt = new Date(Date.now() + this.sessionTimeout)

    const session: ChunkedUploadSession = {
      sessionId,
      userId,
      fileName,
      contentType,
      totalChunks,
      chunkSize,
      uploadedChunks: new Map(),
      metadata,
      createdAt: new Date(),
      expiresAt
    }

    this.sessions.set(sessionId, session)

    console.log(`[ChunkedUpload] Initialized session ${sessionId} for file ${fileName} with ${totalChunks} chunks`)

    return {
      sessionId,
      totalChunks,
      chunkSize
    }
  }

  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`)
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunkIndex}`)
    }

    if (chunkData.length > session.chunkSize) {
      throw new Error(`Chunk size exceeds limit: ${chunkData.length} > ${session.chunkSize}`)
    }

    // Store the chunk
    session.uploadedChunks.set(chunkIndex, chunkData)

    console.log(`[ChunkedUpload] Uploaded chunk ${chunkIndex + 1}/${session.totalChunks} for session ${sessionId}`)
  }

  async finalizeChunkedUpload(sessionId: string): Promise<{ path: string; url: string; size: number; id: string }> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`)
    }

    // Check if all chunks are uploaded
    if (session.uploadedChunks.size !== session.totalChunks) {
      const missingChunks = Array.from({ length: session.totalChunks }, (_, i) => i)
        .filter(i => !session.uploadedChunks.has(i))
      throw new Error(`Missing chunks: ${missingChunks.join(', ')}`)
    }

    // Reconstruct file from chunks
    const chunks: Buffer[] = []
    for (let i = 0; i < session.totalChunks; i++) {
      const chunk = session.uploadedChunks.get(i)
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`)
      }
      chunks.push(chunk)
    }

    // Upload to Azure Blob Storage
    const result = await azureBlobService.uploadLargeFile(
      chunks,
      session.fileName,
      session.contentType,
      {
        ...session.metadata,
        userId: session.userId,
        originalName: session.fileName.split('/').pop() || '',
        uploadType: 'chunked',
        sessionId
      }
    )

    // Clean up session
    this.sessions.delete(sessionId)

    console.log(`[ChunkedUpload] Finalized upload for session ${sessionId}: ${result.path}`)

    return result
  }

  async getUploadStatus(sessionId: string): Promise<ChunkedUploadStatus> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return {
        sessionId,
        uploadedChunks: [],
        totalChunks: 0,
        status: 'failed',
        error: 'Session not found or expired'
      }
    }

    const uploadedChunks = Array.from(session.uploadedChunks.keys()).sort((a, b) => a - b)
    const isComplete = uploadedChunks.length === session.totalChunks

    return {
      sessionId,
      uploadedChunks,
      totalChunks: session.totalChunks,
      status: isComplete ? 'completed' : 'uploading'
    }
  }

  async cancelUpload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`)
    }

    // Clean up session
    this.sessions.delete(sessionId)

    console.log(`[ChunkedUpload] Cancelled upload for session ${sessionId}`)
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private cleanupExpiredSessions(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`[ChunkedUpload] Cleaned up ${cleanedCount} expired sessions`)
    }
  }

  getActiveSessionsCount(): number {
    return this.sessions.size
  }
}

export const chunkedUploadService = new ChunkedUploadService() 