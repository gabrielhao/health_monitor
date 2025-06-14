import { supabase } from './supabase'
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
    const { data, error } = await supabase
      .from('rag_import_sessions')
      .insert({
        user_id: userId,
        total_files: fileCount,
        processed_files: 0,
        failed_files: 0,
        total_chunks: 0,
        total_embeddings: 0,
        status: 'processing',
        error_log: []
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateImportSession(
    sessionId: string, 
    updates: Partial<RAGImportSession>
  ): Promise<RAGImportSession> {
    const { data, error } = await supabase
      .from('rag_import_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async uploadFile(file: File, userId: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}_${file.name}`
    
    const { data, error } = await supabase.storage
      .from('rag-documents')
      .upload(fileName, file)

    if (error) throw error
    return fileName
  }

  static async processDocument(
    file: File,
    userId: string,
    sessionId: string,
    options: RAGProcessingOptions
  ): Promise<RAGDocument> {
    try {
      // Upload file to storage
      const filePath = await this.uploadFile(file, userId)

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('rag_documents')
        .insert({
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
        .select()
        .single()

      if (docError) throw docError

      // Process document via edge function
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'process-rag-document',
        {
          body: {
            documentId: document.id,
            filePath,
            options
          }
        }
      )

      if (processError) throw processError

      return processResult.document
    } catch (error) {
      console.error('Document processing failed:', error)
      throw error
    }
  }

  static async getDocuments(userId: string, limit = 50): Promise<RAGDocument[]> {
    const { data, error } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  static async getImportSessions(userId: string): Promise<RAGImportSession[]> {
    const { data, error } = await supabase
      .from('rag_import_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async searchSimilarChunks(
    query: string,
    userId: string,
    limit = 10
  ): Promise<RAGChunk[]> {
    // First, generate embedding for the query
    const { data: embeddingResult, error: embeddingError } = await supabase.functions.invoke(
      'generate-query-embedding',
      {
        body: { query }
      }
    )

    if (embeddingError) throw embeddingError

    // Search for similar chunks using vector similarity
    const { data, error } = await supabase.rpc('search_similar_chunks', {
      query_embedding: embeddingResult.embedding,
      user_id_param: userId,
      match_threshold: 0.8,
      match_count: limit
    })

    if (error) throw error
    return data || []
  }

  static async deleteDocument(documentId: string): Promise<void> {
    // Delete chunks first
    await supabase
      .from('rag_chunks')
      .delete()
      .eq('document_id', documentId)

    // Delete document
    const { error } = await supabase
      .from('rag_documents')
      .delete()
      .eq('id', documentId)

    if (error) throw error
  }

  static getFileIcon(fileType: string): string {
    switch (fileType) {
      case 'application/pdf':
        return '📄'
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '📝'
      case 'text/plain':
        return '📃'
      case 'text/csv':
        return '📊'
      case 'application/json':
        return '🔧'
      case 'application/xml':
      case 'text/xml':
        return '📋'
      default:
        return '📁'
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}