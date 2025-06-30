import { azureCosmos } from './azureCosmos'
import { azureBlob } from './azureBlob'
import { azureEmbedding } from './azureEmbedding'
import type { RAGDocument, RAGChunk, RAGImportSession } from '@/types/rag' // Removed unused RAGProcessingOptions

export class RAGService {
  private static readonly SUPPORTED_FORMATS = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml'
  ]

  private static readonly MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
  private static readonly MAX_FILES = 50

  // Helper function to safely convert date to ISO string
  private static toISOString(date: Date | string | undefined): string | undefined {
    if (!date) return undefined
    if (typeof date === 'string') return date
    return date.toISOString()
  }

  // Helper function to safely convert date to ISO string (required)
  private static toRequiredISOString(date: Date | string): string {
    if (typeof date === 'string') return date
    return date.toISOString()
  }

  static validateFiles(files: FileList): { valid: File[], invalid: { file: File, reason: string }[] } {
    const valid: File[] = []
    const invalid: { file: File, reason: string }[] = []

    if (files.length > this.MAX_FILES) {
      throw new Error(`Maximum ${this.MAX_FILES} files allowed`)
    }

    Array.from(files).forEach(file => {
      if (file.size > this.MAX_FILE_SIZE) {
        invalid.push({ file, reason: `File size exceeds 1GB limit` })
      } else if (!this.SUPPORTED_FORMATS.includes(file.type)) {
        invalid.push({ file, reason: `Unsupported file format: ${file.type}` })
      } else {
        valid.push(file)
      }
    })

    return { valid, invalid }
  }

  static async createImportSession(userId: string, fileCount: number): Promise<RAGImportSession> {
    const session = await azureCosmos.createRagImportSession({
      user_id: userId,
      total_files: fileCount,
      processed_files: 0,
      failed_files: 0,
      total_chunks: 0,
      total_embeddings: 0,
      status: 'processing',
      error_log: [],
      _partitionKey: userId
    })

    // Convert RagImportSession to RAGImportSession
    return {
      ...session,
      started_at: this.toRequiredISOString(session.started_at),
      completed_at: this.toISOString(session.completed_at),
      error_log: session.error_log || [],
      _partitionKey: userId
    }
  }

  static async updateImportSession(
    sessionId: string, 
    userId: string,
    updates: Partial<RAGImportSession>
  ): Promise<RAGImportSession> {
    // Convert string dates to Date objects for the database
    const dbUpdates: any = { ...updates }
    if (updates.completed_at) {
      dbUpdates.completed_at = new Date(updates.completed_at)
    }
    
    const session = await azureCosmos.updateRagImportSession(sessionId, userId, dbUpdates)
    
    // Convert back to RAGImportSession format
    return {
      ...session,
      started_at: this.toRequiredISOString(session.started_at),
      completed_at: this.toISOString(session.completed_at),
      error_log: session.error_log || [],
      _partitionKey: userId
    }
  }

  static async uploadFile(file: File, userId: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}_${file.name}`
    
    const result = await azureBlob.uploadFile(file, userId, fileName)
    return result.path
  }



  static async getDocuments(userId: string, limit = 50): Promise<RAGDocument[]> {
    const documents = await azureCosmos.getRagDocuments(userId, { limit })
    
    // Convert RagDocument[] to RAGDocument[]
    return (documents || []).map(doc => ({
      id: doc.id,
      user_id: doc.user_id,
      documentId: doc.documentId,
      documentFilePath: doc.documentFilePath,
      isProcessed: doc.isProcessed,
      uploadDate: doc.uploadDate,
      fileSize: doc.fileSize,
      contentType: doc.contentType,
      originalFileName: doc.originalFileName,
      metadata: doc.metadata || {},
      _partitionKey: doc.user_id
    }))
  }

  static async getImportSessions(userId: string): Promise<RAGImportSession[]> {
    const sessions = await azureCosmos.getRagImportSessions(userId)
    
    // Convert RagImportSession[] to RAGImportSession[]
    return (sessions || []).map(session => ({
      ...session,
      started_at: session.started_at,
      completed_at: session.completed_at,
      error_log: session.error_log || [],
      _partitionKey: session.user_id
    }))
  }

  static async searchSimilarChunks(
    query: string,
    userId: string,
    limit = 10
  ): Promise<RAGChunk[]> {
    // First, generate embedding for the query
    const embedding = await azureEmbedding.generateQueryEmbedding(query)

    // Search for similar chunks using vector similarity
    const similarChunks = await azureCosmos.searchSimilarRagChunks(
      embedding,
      userId,
      {
        threshold: 0.8,
        limit
      }
    )

    // Convert RagChunk[] to RAGChunk[]
    return (similarChunks || []).map(chunk => ({
      ...chunk,
      embedding: chunk.embedding || [],
      created_at: chunk.created_at,
      metadata: chunk.metadata || {},
      _partitionKey: chunk.user_id
    }))
  }

  static async deleteDocument(documentId: string, userId: string): Promise<void> {
    // Delete chunks first
    await azureCosmos.deleteRagChunksByDocument(documentId, userId)

    // Delete document
    await azureCosmos.deleteRagDocument(documentId, userId)
  }

  static getFileIcon(fileType: string): string {
    const iconMap: Record<string, string> = {
      'application/pdf': '📄',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
      'text/plain': '📄',
      'text/csv': '📊',
      'application/json': '📋',
      'application/xml': '📄',
      'text/xml': '📄'
    }
    
    return iconMap[fileType] || '📄'
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}