/*
  # Update health_documents table structure

  1. Changes to health_documents table
    - Add new columns for file metadata (description, file_name, file_type, file_url, size_bytes, uploaded_at)
    - Update foreign key reference from user_profiles to users
    - Remove old columns (source_app, document_type, content, metadata, file_path, import_session_id, processed_at, created_at)
    - Update constraints and indexes

  2. Security
    - Existing RLS policies will continue to work for basic CRUD operations
*/

-- Migration to transform health_documents table to new schema
-- This will modify the existing table structure to match the desired format

-- First, remove constraints and dependencies that might conflict
-- Note: You may need to handle any dependent tables/views before running this

-- Add new columns
ALTER TABLE health_documents 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT now();

-- Update user_id reference to point to users table instead of user_profiles
-- Note: This assumes you have a 'users' table. If not, you may need to create it first
-- or adjust the reference as needed
ALTER TABLE health_documents 
DROP CONSTRAINT IF EXISTS health_documents_user_id_fkey;

ALTER TABLE health_documents 
ADD CONSTRAINT health_documents_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id);

-- Remove NOT NULL constraint from user_id to match new schema
ALTER TABLE health_documents 
ALTER COLUMN user_id DROP NOT NULL;

-- Remove NOT NULL constraints from title to match new schema  
ALTER TABLE health_documents 
ALTER COLUMN title DROP NOT NULL;

-- Drop columns that are not in the new schema
ALTER TABLE health_documents 
DROP COLUMN IF EXISTS source_app,
DROP COLUMN IF EXISTS document_type,
DROP COLUMN IF EXISTS content,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS file_path,
DROP COLUMN IF EXISTS import_session_id,
DROP COLUMN IF EXISTS processed_at,
DROP COLUMN IF EXISTS created_at;

-- Update any indexes that reference dropped columns
DROP INDEX IF EXISTS idx_health_documents_source;
DROP INDEX IF EXISTS idx_health_documents_type; 
DROP INDEX IF EXISTS idx_health_documents_created;

-- Keep the user_id index as it's still relevant
-- CREATE INDEX IF NOT EXISTS idx_health_documents_user_id ON health_documents(user_id);

-- Note: You may also need to update any RLS policies that reference the dropped columns
-- The existing RLS policies should still work for basic CRUD operations on user_id 