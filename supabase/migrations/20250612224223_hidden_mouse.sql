/*
  # Add vector storage for RAG functionality

  1. New Tables
    - `health_documents` - Store imported health documents and metadata
    - `health_embeddings` - Store vector embeddings for RAG
    - `import_sessions` - Track health data import sessions
    - `data_sources` - Manage different health app integrations

  2. Extensions
    - Enable pgvector extension for vector operations

  3. Security
    - Enable RLS on all new tables
    - Add policies for user data isolation
*/

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Health documents table for storing imported health data
CREATE TABLE IF NOT EXISTS health_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  source_app text NOT NULL, -- 'apple_health', 'google_fit', 'fitbit', etc.
  document_type text NOT NULL, -- 'workout', 'heart_rate', 'sleep', 'nutrition', etc.
  title text NOT NULL,
  content text NOT NULL, -- Raw or processed health data
  metadata jsonb DEFAULT '{}', -- Additional structured data
  file_path text, -- Path to original file if stored
  import_session_id uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Vector embeddings table for RAG functionality
CREATE TABLE IF NOT EXISTS health_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES health_documents(id) ON DELETE CASCADE NOT NULL,
  content_chunk text NOT NULL, -- Text chunk that was embedded
  embedding vector(1536), -- OpenAI ada-002 embedding size
  chunk_index integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Import sessions to track bulk imports
CREATE TABLE IF NOT EXISTS import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  source_app text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  error_log jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Data sources configuration
CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  source_type text NOT NULL, -- 'apple_health', 'google_fit', etc.
  source_name text NOT NULL,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_frequency text DEFAULT 'manual', -- 'manual', 'daily', 'weekly'
  auth_token_encrypted text, -- Encrypted authentication tokens
  configuration jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE health_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for health_documents
CREATE POLICY "Users can read own health documents"
  ON health_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health documents"
  ON health_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health documents"
  ON health_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health documents"
  ON health_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for health_embeddings
CREATE POLICY "Users can read own health embeddings"
  ON health_embeddings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health embeddings"
  ON health_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health embeddings"
  ON health_embeddings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for import_sessions
CREATE POLICY "Users can read own import sessions"
  ON import_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import sessions"
  ON import_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import sessions"
  ON import_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for data_sources
CREATE POLICY "Users can read own data sources"
  ON data_sources
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data sources"
  ON data_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data sources"
  ON data_sources
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data sources"
  ON data_sources
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_health_documents_user_id ON health_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_health_documents_source ON health_documents(user_id, source_app);
CREATE INDEX IF NOT EXISTS idx_health_documents_type ON health_documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_health_documents_created ON health_documents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_embeddings_user_id ON health_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_health_embeddings_document ON health_embeddings(document_id);

-- Vector similarity search index (using cosine distance)
CREATE INDEX IF NOT EXISTS idx_health_embeddings_vector 
ON health_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_import_sessions_user_id ON import_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_data_sources_user_id ON data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(user_id, is_active);

-- Function to search similar health content using vector similarity
CREATE OR REPLACE FUNCTION search_similar_health_content(
  query_embedding vector(1536),
  user_id_param uuid,
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  document_id uuid,
  content_chunk text,
  similarity float,
  document_title text,
  document_type text,
  source_app text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    he.document_id,
    he.content_chunk,
    1 - (he.embedding <=> query_embedding) as similarity,
    hd.title as document_title,
    hd.document_type,
    hd.source_app
  FROM health_embeddings he
  JOIN health_documents hd ON he.document_id = hd.id
  WHERE he.user_id = user_id_param
    AND 1 - (he.embedding <=> query_embedding) > match_threshold
  ORDER BY he.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger to update data_sources updated_at
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();