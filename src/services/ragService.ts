import { azureCosmos } from './azureCosmos'
import { azureBlob } from './azureBlob'
import { azureEmbedding } from './azureEmbedding'
import type { RAGDocument, RAGChunk, RAGImportSession, RAGProcessingOptions } from '@/types/rag'

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
      error_log: []
    })

    return session
  }

  static async updateImportSession(
    sessionId: string, 
    userId: string,
    updates: Partial<RAGImportSession>
  ): Promise<RAGImportSession> {
    const session = await azureCosmos.updateRagImportSession(sessionId, userId, updates)
    return session
  }

  static async uploadFile(file: File, userId: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}_${file.name}`
    
    const result = await azureBlob.uploadFile(file, userId, fileName)
    return result.path
  }

  static async processDocument(
    file: File,
    userId: string,
    sessionId: string,
    options: RAGProcessingOptions
  ): Promise<RAGDocument> {
    try {
      // Upload file to Azure Blob Storage
      const filePath = await this.uploadFile(file, userId)

      // Create document record in Cosmos DB
      const document = await azureCosmos.createRagDocument({
        user_id: userId,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        content: '', // Will be updated after processing
        status: 'processing',
        chunk_count: 0,
        embedding_count: 0,
        metadata: {
          file_path: filePath,
          session_id: sessionId,
          processing_options: options
        }
      })

      // Process document via Azure Function
      const processResult = await this.callAzureFunction('process-rag-document', {
        documentId: document.id,
        filePath,
        options
      })

      return processResult.document
    } catch (error) {
      console.error('Document processing failed:', error)
      throw error
    }
  }

  static async getDocuments(userId: string, limit = 50): Promise<RAGDocument[]> {
    const documents = await azureCosmos.getRagDocuments(userId, { limit })
    return documents || []
  }

  static async getImportSessions(userId: string): Promise<RAGImportSession[]> {
    const sessions = await azureCosmos.getRagImportSessions(userId)
    return sessions || []
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

    return similarChunks || []
  }

  static async deleteDocument(documentId: string, userId: string): Promise<void> {
    // Delete chunks first
    await azureCosmos.deleteRagChunksByDocument(documentId, userId)

    // Delete document
    await azureCosmos.deleteRagDocument(documentId, userId)
  }

  private static async callAzureFunction(functionName: string, body: any): Promise<any> {
    // Call Azure Function using HTTP request
    const response = await fetch(`/api/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Azure Function call failed: ${response.statusText}`)
    }

    return await response.json()
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