export interface HealthDocument {
  id: string
  user_id: string
  source_app: string
  document_type: string
  title: string
  content: string
  metadata: Record<string, any>
  file_path?: string
  import_session_id?: string
  processed_at?: string
  created_at: string
  _partitionKey: string
}

export interface HealthEmbedding {
  id: string
  user_id: string
  document_id: string
  content_chunk: string
  embedding: number[]
  chunk_index: number
  metadata: Record<string, any>
  created_at: string
  _partitionKey: string
}

export interface ImportSession {
  id: string
  user_id: string
  source_app: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_records: number
  processed_records: number
  failed_records: number
  error_log: any[]
  metadata: Record<string, any>
  started_at: string
  completed_at?: string
  _partitionKey: string
}

export interface DataSource {
  id: string
  user_id: string
  source_type: string
  source_name: string
  is_active: boolean
  last_sync_at?: string
  sync_frequency: 'manual' | 'daily' | 'weekly'
  auth_token_encrypted?: string
  configuration: Record<string, any>
  created_at: string
  updated_at: string
  _partitionKey: string
}

export interface SimilarContent {
  document_id: string
  content_chunk: string
  similarity: number
  document_title: string
  document_type: string
  source_app: string
  _partitionKey: string
}

export interface HealthDataImport {
  source: string
  data: any[]
  metadata?: Record<string, any>
  _partitionKey: string
}

export interface AppleHealthData {
  type: string
  value: number | string
  unit?: string
  startDate: string
  endDate: string
  sourceName: string
  sourceVersion?: string
  device?: string
  metadata?: Record<string, any>
  _partitionKey: string
}

export interface ProcessedHealthData {
  title: string
  content: string
  document_type: string
  metadata: Record<string, any>
  _partitionKey: string
}