export interface RAGDocument {
  id: string
  user_id: string
  filename: string
  file_type: string
  file_size: number
  content: string
  status: 'processing' | 'completed' | 'failed'
  error_message?: string
  chunk_count: number
  embedding_count: number
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface RAGChunk {
  id: string
  document_id: string
  user_id: string
  content: string
  embedding: number[]
  chunk_index: number
  token_count: number
  metadata: Record<string, any>
  created_at: string
}

export interface RAGImportSession {
  id: string
  user_id: string
  total_files: number
  processed_files: number
  failed_files: number
  total_chunks: number
  total_embeddings: number
  status: 'processing' | 'completed' | 'failed'
  error_log: any[]
  started_at: string
  completed_at?: string
}

export interface FileUploadProgress {
  filename: string
  size: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
}

export interface RAGProcessingOptions {
  chunkSize: number
  chunkOverlap: number
  generateEmbeddings: boolean
  preserveFormatting: boolean
  uploadCompleteFile: boolean
}