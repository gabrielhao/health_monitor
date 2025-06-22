import { azureVectorService } from './azureVectorService'
import type { 
  HealthDocument, 
  HealthEmbedding, 
  ImportSession
} from './azureConfig'
import type {
  VectorSearchOptions,
  VectorSearchResult
} from './azureVectorService'

export class VectorService {
  // Initialize the service
  static async initialize(): Promise<void> {
    await azureVectorService.initialize()
  }

  // Health Documents
  static async createHealthDocument(
    userId: string,
    title: string,
    content: string,
    sourceApp: string,
    documentType: string,
    metadata?: Record<string, any>,
    filePath?: string,
    importSessionId?: string
  ): Promise<HealthDocument> {
    return await azureVectorService.createHealthDocument(
      userId, title, content, sourceApp, documentType, metadata, filePath, importSessionId
    )
  }

  static async getHealthDocuments(userId: string, filters?: {
    source_app?: string
    document_type?: string
    limit?: number
  }): Promise<HealthDocument[]> {
    return await azureVectorService.getHealthDocuments(userId, filters)
  }

  // Vector Embeddings
  static async createEmbedding(
    userId: string,
    documentId: string,
    contentChunk: string,
    embedding: number[],
    chunkIndex: number = 0,
    metadata?: Record<string, any>
  ): Promise<HealthEmbedding> {
    return await azureVectorService.createEmbedding(
      userId, documentId, contentChunk, embedding, chunkIndex, metadata
    )
  }

  static async searchSimilarContent(
    queryEmbedding: number[],
    userId: string,
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    return await azureVectorService.searchSimilarContent(queryEmbedding, userId, options)
  }

  // Import Sessions
  static async createImportSession(
    userId: string,
    sourceApp: string,
    totalRecords: number = 0,
    metadata?: Record<string, any>
  ): Promise<ImportSession> {
    return await azureVectorService.createImportSession(userId, sourceApp, totalRecords, metadata)
  }

  static async updateImportSession(
    sessionId: string,
    userId: string,
    updates: {
      status?: 'pending' | 'processing' | 'completed' | 'failed'
      processed_records?: number
      failed_records?: number
      error_log?: string[]
      completed_at?: Date
    }
  ): Promise<ImportSession> {
    return await azureVectorService.updateImportSession(sessionId, userId, updates)
  }

  static async getImportSession(sessionId: string, userId: string): Promise<ImportSession | null> {
    return await azureVectorService.getImportSession(sessionId, userId)
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    return await azureVectorService.healthCheck()
  }
}