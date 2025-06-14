/*
  # Create RAG Document Processing Tables

  1. New Tables
    - `rag_documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `filename` (text)
      - `file_type` (text)
      - `file_size` (integer)
      - `content` (text)
      - `status` (text)
      - `error_message` (text, nullable)
      - `chunk_count` (integer)
      - `embedding_count` (integer)
      - `metadata` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `rag_chunks`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to rag_documents)
      - `user_id` (uuid, foreign key to user_profiles)
      - `content` (text)
      - `embedding` (vector)
      - `chunk_index` (integer)
      - `token_count` (integer)
      - `metadata` (jsonb)
      - `created_at` (timestamp)

    - `rag_import_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `total_files` (integer)
      - `processed_files` (integer)
      - `failed_files` (integer)
      - `total_chunks` (integer)
      - `total_embeddings` (integer)
      - `status` (text)
      - `error_log` (jsonb)
      - `started_at` (timestamp)
      - `completed_at` (timestamp, nullable)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Add indexes for efficient querying
    - Vector similarity search index
*/

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create rag_documents table
CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  content text DEFAULT '',
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,
  chunk_count integer DEFAULT 0,
  embedding_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rag_chunks table
CREATE TABLE IF NOT EXISTS rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  chunk_index integer NOT NULL,
  token_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create rag_import_sessions table
CREATE TABLE IF NOT EXISTS rag_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  total_files integer NOT NULL DEFAULT 0,
  processed_files integer NOT NULL DEFAULT 0,
  failed_files integer NOT NULL DEFAULT 0,
  total_chunks integer NOT NULL DEFAULT 0,
  total_embeddings integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_log jsonb DEFAULT '[]',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_import_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rag_documents
CREATE POLICY "Users can read own documents"
  ON rag_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON rag_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON rag_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON rag_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for rag_chunks
CREATE POLICY "Users can read own chunks"
  ON rag_chunks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
  ON rag_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
  ON rag_chunks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for rag_import_sessions
CREATE POLICY "Users can read own import sessions"
  ON rag_import_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import sessions"
  ON rag_import_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import sessions"
  ON rag_import_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id ON rag_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_id ON rag_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_rag_import_sessions_user_id ON rag_import_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_import_sessions_status ON rag_import_sessions(user_id, status);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(1536),
  user_id_param uuid,
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  chunk_index int,
  token_count int,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_chunks.id,
    rag_chunks.document_id,
    rag_chunks.content,
    1 - (rag_chunks.embedding <=> query_embedding) AS similarity,
    rag_chunks.chunk_index,
    rag_chunks.token_count,
    rag_chunks.metadata
  FROM rag_chunks
  WHERE rag_chunks.user_id = user_id_param
    AND 1 - (rag_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY rag_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rag_documents_updated_at
  BEFORE UPDATE ON rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();