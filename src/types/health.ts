export interface HealthUploadOptions {
  source: string
  chunkSize?: number
  notes?: string
  generateEmbeddings?: boolean
}

export interface HealthDataImport {
  source: string
  data: any[]
  metadata?: Record<string, any>
  _partitionKey: string
}

export interface HealthImportSession {
  id: string
  user_id: string
  source_app: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_records: number
  processed_records: number
  failed_records: number
  error_log: { error: string; timestamp?: string; item?: string }[]
  metadata: Record<string, any>
  started_at: string
  completed_at?: string
  _partitionKey: string
}

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

export interface HealthProgressItem {
  filename: string
  size: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  speed?: string
  eta?: string
}

export interface AppleHealthRecord {
  type: string
  value: number | string
  unit?: string
  startDate: string
  endDate: string
  sourceName: string
  sourceVersion?: string
  device?: string
  metadata?: Record<string, any>
} 