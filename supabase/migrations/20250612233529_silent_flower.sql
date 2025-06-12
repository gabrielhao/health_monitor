/*
  # Create Storage Bucket for Health Files

  1. Storage Setup
    - Create health-files bucket for temporary file storage
    - Set up appropriate policies for authenticated users
    - Configure automatic cleanup

  2. Security
    - Users can only upload to their own folder
    - Files are automatically cleaned up after processing
    - Secure access controls
*/

-- Create storage bucket for health file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('health-files', 'health-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload health files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'health-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own files
CREATE POLICY "Users can read own health files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'health-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own health files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'health-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow service role to manage all files (for cleanup)
CREATE POLICY "Service role can manage all health files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'health-files');