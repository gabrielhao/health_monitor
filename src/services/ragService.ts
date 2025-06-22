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
      error_log: session.error_log || []
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
      error_log: session.error_log || []
    }
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

      // Read file content
      const fileContent = await this.readFileContent(file)

      // Create document record in Cosmos DB
      const document = await azureCosmos.createRagDocument({
        user_id: userId,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        content: options.uploadCompleteFile ? fileContent : '', // Store full content if uploading complete file
        status: 'processing',
        chunk_count: options.uploadCompleteFile ? 1 : 0, // Complete file counts as 1 chunk
        embedding_count: 0,
        metadata: {
          file_path: filePath,
          session_id: sessionId,
          processing_options: options,
          upload_complete_file: options.uploadCompleteFile
        },
        _partitionKey: userId
      })

      // If uploading complete file, create a single chunk with the entire content
      if (options.uploadCompleteFile) {
        // Create single chunk for the entire file
        const chunk = await azureCosmos.createRagChunk({
          document_id: document.id,
          user_id: userId,
          content: fileContent,
          embedding: [], // Will be populated if embeddings are generated
          chunk_index: 0,
          token_count: this.estimateTokenCount(fileContent),
          metadata: {
            is_complete_file: true,
            file_name: file.name,
            file_type: file.type
          },
          _partitionKey: userId
        })

        // Generate embedding for the complete file if requested
        if (options.generateEmbeddings) {
          try {
            const embedding = await azureEmbedding.generateSingleEmbedding(fileContent)
            
            // Since there's no update method, we'll delete and recreate the chunk with embedding
            await azureCosmos.deleteRagChunksByDocument(document.id, userId)
            
            const updatedChunk = await azureCosmos.createRagChunk({
              document_id: document.id,
              user_id: userId,
              content: fileContent,
              embedding: embedding,
              chunk_index: 0,
              token_count: this.estimateTokenCount(fileContent),
              metadata: {
                is_complete_file: true,
                file_name: file.name,
                file_type: file.type
              },
              _partitionKey: userId
            })

            // Update document embedding count
            await azureCosmos.updateRagDocument(document.id, userId, {
              embedding_count: 1,
              status: 'completed'
            })
          } catch (embeddingError) {
            console.error('Error generating embedding for complete file:', embeddingError)
            // Update document with error status
            await azureCosmos.updateRagDocument(document.id, userId, {
              status: 'failed',
              error_message: `Embedding generation failed: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`
            })
          }
        } else {
          // Mark as completed without embeddings
          await azureCosmos.updateRagDocument(document.id, userId, {
            status: 'completed'
          })
        }

        // Convert RagDocument to RAGDocument
        return {
          ...document,
          created_at: this.toRequiredISOString(document.created_at),
          updated_at: this.toRequiredISOString(document.updated_at),
          metadata: document.metadata || {}
        }
      }

      // Original chunked processing logic
      // NEW: Try to trigger processing via backend service if available
      try {
        const { nodeFileUploadService } = await import('./nodeFileUploadService')
        await nodeFileUploadService.processRAGDocument(document.id, userId, {
          batchSize: options.chunkSize || 512,
          transformOptions: options
        })
        console.log('Successfully triggered backend processing for document:', document.id)
      } catch (backendError) {
        console.warn('Backend processing not available, falling back to Azure Function:', backendError)
        
        // Fallback: Process document via Azure Function
        const processResult = await this.callAzureFunction('process-rag-document', {
          documentId: document.id,
          filePath,
          options
        })
        
        return processResult.document
      }

      // Convert RagDocument to RAGDocument
      return {
        ...document,
        created_at: this.toRequiredISOString(document.created_at),
        updated_at: this.toRequiredISOString(document.updated_at),
        metadata: document.metadata || {}
      }
    } catch (error) {
      console.error('Document processing failed:', error)
      throw error
    }
  }

  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const result = event.target?.result
        if (typeof result === 'string') {
          resolve(result)
        } else {
          // Handle binary files by converting to base64
          const arrayBuffer = result as ArrayBuffer
          const uint8Array = new Uint8Array(arrayBuffer)
          const binaryString = Array.from(uint8Array)
            .map(byte => String.fromCharCode(byte))
            .join('')
          resolve(btoa(binaryString))
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      
      // Try to read as text first, fallback to binary
      if (file.type.startsWith('text/') || 
          file.type === 'application/json' || 
          file.type === 'application/xml') {
        reader.readAsText(file)
      } else {
        reader.readAsArrayBuffer(file)
      }
    })
  }

  private static estimateTokenCount(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4)
  }

  static async getDocuments(userId: string, limit = 50): Promise<RAGDocument[]> {
    const documents = await azureCosmos.getRagDocuments(userId, { limit })
    
    // Convert RagDocument[] to RAGDocument[]
    return (documents || []).map(doc => ({
      ...doc,
      created_at: this.toRequiredISOString(doc.created_at),
      updated_at: this.toRequiredISOString(doc.updated_at),
      metadata: doc.metadata || {}
    }))
  }

  static async getImportSessions(userId: string): Promise<RAGImportSession[]> {
    const sessions = await azureCosmos.getRagImportSessions(userId)
    
    // Convert RagImportSession[] to RAGImportSession[]
    return (sessions || []).map(session => ({
      ...session,
      started_at: this.toRequiredISOString(session.started_at),
      completed_at: this.toISOString(session.completed_at),
      error_log: session.error_log || []
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
      created_at: this.toRequiredISOString(chunk.created_at),
      metadata: chunk.metadata || {}
    }))
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