import { azureCosmos } from './azureCosmos'
import type { 
  HealthDocument, 
  HealthEmbedding, 
  ImportSession,
  RagDocument,
  RagChunk,
  RagImportSession
} from './azureConfig'

export interface VectorSearchOptions {
  threshold?: number
  limit?: number
  includeMetadata?: boolean
}

export interface VectorSearchResult {
  id: string
  content: string
  metadata?: Record<string, any>
  similarity: number
  document_id?: string
  chunk_index?: number
}

class AzureVectorService {
  async initialize(): Promise<void> {
    await azureCosmos.initialize()
  }

  // Health Documents with Vector Search
  async createHealthDocument(
    userId: string,
    title: string,
    content: string,
    sourceApp: string,
    documentType: string,
    metadata?: Record<string, any>,
    filePath?: string,
    importSessionId?: string
  ): Promise<HealthDocument> {
    const azureDocument: Omit<HealthDocument, 'id' | 'created_at'> = {
      user_id: userId,
      source_app: sourceApp,
      document_type: documentType,
      title,
      content,
      metadata,
      file_path: filePath,
      import_session_id: importSessionId,
      processed_at: new Date(),
      _partitionKey: userId
    }

    const result = await azureCosmos.createHealthDocument(azureDocument)
    return result
  }

  async getHealthDocuments(
    userId: string,
    filters?: {
      source_app?: string
      document_type?: string
      limit?: number
    }
  ): Promise<HealthDocument[]> {
    const documents = await azureCosmos.getHealthDocuments(userId, filters)
    return documents
  }

  // Vector Embeddings
  async createEmbedding(
    userId: string,
    documentId: string,
    contentChunk: string,
    embedding: number[],
    chunkIndex: number = 0,
    metadata?: Record<string, any>
  ): Promise<HealthEmbedding> {
    const azureEmbedding: Omit<HealthEmbedding, 'id' | 'created_at'> = {
      user_id: userId,
      document_id: documentId,
      content_chunk: contentChunk,
      embedding,
      chunk_index: chunkIndex,
      metadata,
      _partitionKey: userId
    }

    const result = await azureCosmos.createEmbedding(azureEmbedding)
    return result
  }

  async searchSimilarContent(
    queryEmbedding: number[],
    userId: string,
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const results = await azureCosmos.searchSimilarContent(queryEmbedding, userId, options)
    
    return results.map((result: any) => ({
      id: result.id,
      content: result.content_chunk,
      metadata: result.metadata,
      similarity: result.similarity,
      document_id: result.document_id,
      chunk_index: result.chunk_index
    }))
  }

  // Import Sessions
  async createImportSession(
    userId: string,
    sourceApp: string,
    totalRecords: number = 0,
    metadata?: Record<string, any>
  ): Promise<ImportSession> {
    const azureSession: Omit<ImportSession, 'id' | 'started_at'> = {
      user_id: userId,
      source_app: sourceApp,
      status: 'pending',
      total_records: totalRecords,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
      metadata,
      _partitionKey: userId
    }

    const result = await azureCosmos.createImportSession(azureSession)
    return result
  }

  async updateImportSession(
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
    const azureUpdates: Partial<ImportSession> = {
      ...updates
    }

    const result = await azureCosmos.updateImportSession(sessionId, userId, azureUpdates)
    return result
  }

  async getImportSession(sessionId: string, userId: string): Promise<ImportSession | null> {
    return await azureCosmos.getImportSession(sessionId, userId)
  }

  // RAG Documents
  async createRagDocument(
    userId: string,
    filename: string,
    fileType: string,
    fileSize: number,
    content: string = '',
    metadata?: Record<string, any>
  ): Promise<RagDocument> {
    const document: Omit<RagDocument, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      filename,
      file_type: fileType,
      file_size: fileSize,
      content,
      status: 'processing',
      chunk_count: 0,
      embedding_count: 0,
      metadata,
      _partitionKey: userId
    }

    return await azureCosmos.createRagDocument(document)
  }

  async updateRagDocument(
    documentId: string,
    userId: string,
    updates: Partial<RagDocument>
  ): Promise<RagDocument> {
    return await azureCosmos.updateRagDocument(documentId, userId, updates)
  }

  async createRagChunk(
    documentId: string,
    userId: string,
    content: string,
    chunkIndex: number,
    embedding?: number[],
    tokenCount?: number,
    metadata?: Record<string, any>
  ): Promise<RagChunk> {
    const chunk: Omit<RagChunk, 'id' | 'created_at'> = {
      document_id: documentId,
      user_id: userId,
      content,
      embedding,
      chunk_index: chunkIndex,
      token_count: tokenCount || 0,
      metadata,
      _partitionKey: userId
    }

    return await azureCosmos.createRagChunk(chunk)
  }

  async createRagImportSession(
    userId: string,
    totalFiles: number = 0
  ): Promise<RagImportSession> {
    const session: Omit<RagImportSession, 'id' | 'started_at'> = {
      user_id: userId,
      total_files: totalFiles,
      processed_files: 0,
      failed_files: 0,
      total_chunks: 0,
      total_embeddings: 0,
      status: 'processing',
      error_log: [],
      _partitionKey: userId
    }

    return await azureCosmos.createRagImportSession(session)
  }

  async updateRagImportSession(
    sessionId: string,
    userId: string,
    updates: Partial<RagImportSession>
  ): Promise<RagImportSession> {
    return await azureCosmos.updateRagImportSession(sessionId, userId, updates)
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    return await azureCosmos.healthCheck()
  }
}

export const azureVectorService = new AzureVectorService() 