/*
  # Update Embedding Dimensions for gte-small Model

  1. Schema Changes
    - Update health_embeddings.embedding column from vector(1536) to vector(384)
    - This matches the gte-small model output dimensions used in the edge function

  2. Index Updates
    - Recreate the vector index with updated dimensions
    - Maintain performance for similarity searches

  3. Data Migration
    - Note: Existing embeddings will need to be regenerated as dimensions have changed
*/

-- Drop the existing vector index
DROP INDEX IF EXISTS idx_health_embeddings_vector;

-- Update the embedding column to use 384 dimensions for gte-small model
ALTER TABLE health_embeddings 
ALTER COLUMN embedding TYPE vector(384);

-- Recreate the vector index with updated dimensions
CREATE INDEX idx_health_embeddings_vector 
ON health_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists='100');

-- Note: Any existing embeddings will need to be regenerated 
-- as the dimensions have changed from 1536 to 384