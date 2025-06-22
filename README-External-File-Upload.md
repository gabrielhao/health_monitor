# External File Upload Service

This document describes the new external file upload service that integrates with external APIs for handling file uploads, providing an alternative to Azure Blob Storage.

## Overview

The external file upload service provides a comprehensive solution for uploading files to external APIs while maintaining compatibility with the existing codebase. It includes support for:

- Single and batch file uploads
- Chunked uploads for large files (>5MB)
- Progress tracking and cancellation
- Error handling and retry logic
- File validation and metadata management
- Provider switching and fallback mechanisms

## Architecture

### Core Components

1. **ExternalFileUploadService** (`src/services/externalFileUploadService.ts`)
   - Main service class handling API communication
   - Supports direct uploads and chunked uploads
   - Includes comprehensive error handling and retry logic

2. **FileUploadAdapter** (`src/services/fileUploadAdapter.ts`)
   - Adapter pattern implementation for provider switching
   - Unified interface for Azure Blob Storage and External API
   - Automatic fallback between providers

3. **useExternalFileUpload** (`src/composables/useExternalFileUpload.ts`)
   - Vue composable for reactive file upload state management
   - Progress tracking and user interaction handling
   - Integration with authentication store

## Configuration

### Environment Variables

Add these variables to your `.env.local` file:

```env
# External Upload API Configuration
VITE_EXTERNAL_UPLOAD_API_URL=https://api.example.com
VITE_EXTERNAL_UPLOAD_API_KEY=your-api-key-here

# Upload Provider Configuration
VITE_UPLOAD_PROVIDER=external
VITE_UPLOAD_FALLBACK_PROVIDER=azure
```

### API Endpoint Requirements

The external API should implement these endpoints:

#### Single File Upload
```
POST /upload
Content-Type: multipart/form-data

Form fields:
- file: File blob
- userId: string
- metadata: JSON string
```

#### Batch Upload
```
POST /upload/batch
Content-Type: multipart/form-data

Form fields:
- files: Multiple file blobs
- userId: string
- metadata: JSON string
```

#### Chunked Upload Initialization
```
POST /upload/chunked/init
Content-Type: application/json

Body:
{
  "fileName": "string",
  "fileSize": number,
  "fileType": "string",
  "userId": "string",
  "totalChunks": number,
  "chunkSize": number
}

Response:
{
  "success": true,
  "data": {
    "sessionId": "string"
  }
}
```

#### Chunk Upload
```
POST /upload/chunked/chunk
Content-Type: multipart/form-data

Form fields:
- sessionId: string
- chunkIndex: number
- chunk: Blob
```

#### Finalize Chunked Upload
```
POST /upload/chunked/finalize
Content-Type: application/json

Body:
{
  "sessionId": "string"
}

Response:
{
  "success": true,
  "data": {
    "id": "string",
    "url": "string",
    "path": "string",
    "size": number,
    "metadata": object
  }
}
```

#### Additional Endpoints
```
GET /upload/status/{uploadId}     # Get upload status
POST /upload/cancel/{uploadId}    # Cancel upload
DELETE /files/{fileId}            # Delete file
GET /files/{fileId}               # Get file metadata
POST /upload/chunked/cleanup      # Cleanup failed upload
```

## Usage Examples

### Basic File Upload

```typescript
import { useExternalFileUpload } from '@/composables/useExternalFileUpload'

const { uploadFile, uploading, progress, error } = useExternalFileUpload()

const handleFileUpload = async (file: File) => {
  try {
    const result = await uploadFile(file, {
      metadata: { category: 'health-data' },
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress.percentage}%`)
      },
      onChunkComplete: (chunk, total) => {
        console.log(`Chunk ${chunk + 1}/${total} completed`)
      }
    })
    
    console.log('Upload successful:', result)
  } catch (err) {
    console.error('Upload failed:', err)
  }
}
```

### Batch Upload

```typescript
const { uploadBatch, batchUploading } = useExternalFileUpload()

const handleBatchUpload = async (files: File[]) => {
  try {
    const result = await uploadBatch(files, {
      metadata: { batch: true, timestamp: Date.now() }
    })
    
    console.log(`Batch upload completed: ${result.successCount}/${result.totalFiles} successful`)
    
    if (result.failed.length > 0) {
      console.warn('Some files failed:', result.failed)
    }
  } catch (err) {
    console.error('Batch upload failed:', err)
  }
}
```

### Provider Switching

```typescript
const { switchProvider, getProviderConfig } = useExternalFileUpload()

// Switch to Azure Blob Storage
switchProvider('azure')

// Check current configuration
const config = getProviderConfig()
console.log('Current provider:', config.default)
console.log('Fallback provider:', config.fallback)
```

### Upload Management

```typescript
const { 
  getUploadStatus, 
  cancelUpload, 
  deleteFile, 
  getFileMetadata 
} = useExternalFileUpload()

// Check upload status
const status = await getUploadStatus('upload-id')
console.log('Upload status:', status.status, status.progress)

// Cancel ongoing upload
await cancelUpload('upload-id')

// Delete uploaded file
await deleteFile('file-id')

// Get file information
const metadata = await getFileMetadata('file-id')
console.log('File info:', metadata)
```

## Integration with Existing Code

The new service maintains compatibility with existing code through the adapter pattern. To switch from Azure Blob Storage to the external API:

### Option 1: Environment Variable (Recommended)
```env
VITE_UPLOAD_PROVIDER=external
```

### Option 2: Runtime Switching
```typescript
import { fileUploadAdapter } from '@/services/fileUploadAdapter'

// Switch provider at runtime
fileUploadAdapter.setDefaultProvider('external')
```

### Option 3: Per-Upload Provider Selection
```typescript
const result = await uploadFile(file, {
  provider: 'external',
  fallbackProvider: 'azure'
})
```

## File Validation

The service includes comprehensive file validation:

### Supported File Types
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Documents**: PDF, Word, Excel, PowerPoint
- **Text**: Plain text, CSV, XML, JSON
- **Archives**: ZIP, RAR, 7Z
- **Health Data**: Apple Health, Google Fit formats

### File Size Limits
- **Maximum file size**: 5GB
- **Chunked upload threshold**: 5MB
- **Batch upload limit**: 50 files maximum

### Validation Examples
```typescript
// File size validation
if (file.size > 5 * 1024 * 1024 * 1024) {
  throw new Error('File size exceeds 5GB limit')
}

// File type validation
const supportedTypes = ['image/jpeg', 'application/pdf', ...]
if (!supportedTypes.includes(file.type)) {
  console.warn('File type may not be supported')
}
```

## Error Handling

The service provides comprehensive error handling:

### Network Errors
```typescript
try {
  await uploadFile(file)
} catch (error) {
  if (error.message === 'Request timeout') {
    // Handle timeout
  } else if (error.message.includes('HTTP 5')) {
    // Handle server errors
  } else {
    // Handle other errors
  }
}
```

### Retry Logic
- **Automatic retries**: Up to 3 attempts for failed chunks
- **Exponential backoff**: Increasing delays between retries
- **Cleanup**: Automatic cleanup of failed uploads

### Fallback Mechanism
```typescript
// Automatic fallback to Azure if external API fails
const result = await uploadFile(file, {
  provider: 'external',
  fallbackProvider: 'azure'
})
```

## Performance Considerations

### Chunked Uploads
- **Threshold**: Files >5MB are automatically chunked
- **Chunk size**: Configurable (default 5MB)
- **Parallel processing**: Chunks uploaded sequentially for reliability
- **Resume capability**: Failed chunks can be retried individually

### Progress Tracking
- **Real-time updates**: Progress callbacks for UI updates
- **Speed calculation**: Smoothed upload speed estimation
- **ETA calculation**: Estimated time remaining
- **Chunk progress**: Individual chunk completion tracking

### Memory Management
- **Streaming**: Large files processed in chunks to minimize memory usage
- **Cleanup**: Automatic cleanup of temporary resources
- **Validation**: Early validation to prevent unnecessary processing

## Testing

The service includes comprehensive test coverage:

### Unit Tests
- **Service tests**: `src/test/services/externalFileUploadService.test.ts`
- **Adapter tests**: `src/test/services/fileUploadAdapter.test.ts`
- **Composable tests**: `src/test/composables/useExternalFileUpload.test.ts`

### Test Coverage
- ✅ File upload (single and batch)
- ✅ Chunked upload for large files
- ✅ Progress tracking and callbacks
- ✅ Error handling and retries
- ✅ Provider switching and fallback
- ✅ File validation
- ✅ Authentication requirements
- ✅ Network error scenarios

### Running Tests
```bash
# Run all upload service tests
npm test -- src/test/services/externalFileUploadService.test.ts
npm test -- src/test/services/fileUploadAdapter.test.ts
npm test -- src/test/composables/useExternalFileUpload.test.ts

# Run with coverage
npm run test:coverage
```

## Security Considerations

### Authentication
- **API Key**: Secure API key authentication
- **User Context**: All uploads associated with authenticated users
- **Token Validation**: JWT token verification for user requests

### Data Protection
- **HTTPS Only**: All API communication over HTTPS
- **File Validation**: Comprehensive file type and size validation
- **Metadata Sanitization**: Safe handling of user-provided metadata

### Access Control
- **User Isolation**: Files scoped to individual users
- **Permission Checks**: Verify user permissions before operations
- **Audit Logging**: Track all upload operations

## Monitoring and Debugging

### Logging
The service includes comprehensive logging:

```typescript
console.log('[ExternalUpload] Starting upload for file:', file.name)
console.log('[ExternalUpload] Upload completed successfully:', result)
console.error('[ExternalUpload] Upload failed:', error)
```

### Debug Information
- **Request/Response logging**: Full API communication details
- **Progress tracking**: Detailed progress information
- **Error context**: Comprehensive error information with stack traces

### Performance Metrics
- **Upload speed**: Real-time speed calculation
- **Success rates**: Track upload success/failure rates
- **Retry statistics**: Monitor retry patterns and success rates

## Migration Guide

### From Azure Blob Storage

1. **Update Environment Variables**
   ```env
   VITE_UPLOAD_PROVIDER=external
   VITE_EXTERNAL_UPLOAD_API_URL=https://your-api.com
   VITE_EXTERNAL_UPLOAD_API_KEY=your-api-key
   ```

2. **Update Import Statements** (if using direct service)
   ```typescript
   // Before
   import { azureBlob } from '@/services/azureBlob'
   
   // After
   import { fileUploadAdapter } from '@/services/fileUploadAdapter'
   ```

3. **Update Method Calls**
   ```typescript
   // Before
   const result = await azureBlob.uploadFile(file, userId)
   
   // After
   const result = await fileUploadAdapter.uploadFile(file, userId)
   ```

4. **Test Thoroughly**
   - Verify all upload functionality works
   - Test error handling and fallback mechanisms
   - Confirm progress tracking operates correctly

## Troubleshooting

### Common Issues

1. **API Key Authentication Fails**
   ```
   Error: HTTP 401: Unauthorized
   ```
   - Verify `VITE_EXTERNAL_UPLOAD_API_KEY` is set correctly
   - Check API key permissions and expiration

2. **CORS Errors**
   ```
   Error: CORS policy blocks request
   ```
   - Ensure external API includes proper CORS headers
   - Verify domain is whitelisted in API configuration

3. **Large File Upload Fails**
   ```
   Error: Request timeout
   ```
   - Check network stability
   - Verify API supports chunked uploads
   - Adjust chunk size or timeout settings

4. **Fallback Not Working**
   ```
   Error: Upload failed with both providers
   ```
   - Verify Azure Blob Storage configuration
   - Check fallback provider is properly configured
   - Review error logs for specific failure reasons

### Debug Steps

1. **Check Environment Variables**
   ```typescript
   console.log('API URL:', import.meta.env.VITE_EXTERNAL_UPLOAD_API_URL)
   console.log('API Key set:', !!import.meta.env.VITE_EXTERNAL_UPLOAD_API_KEY)
   ```

2. **Test API Connectivity**
   ```typescript
   const response = await fetch(`${apiUrl}/health`)
   console.log('API Health:', response.status)
   ```

3. **Monitor Network Traffic**
   - Use browser DevTools Network tab
   - Check request/response headers
   - Verify payload structure

4. **Enable Verbose Logging**
   ```typescript
   // Add to service constructor
   console.log('[ExternalUpload] Service initialized with:', {
     baseUrl: this.baseUrl,
     hasApiKey: !!this.apiKey
   })
   ```

This external file upload service provides a robust, scalable solution for handling file uploads through external APIs while maintaining full compatibility with existing code and providing comprehensive error handling, progress tracking, and fallback mechanisms.