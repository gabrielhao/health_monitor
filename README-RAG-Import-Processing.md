# RAG Import with Automatic File Processing

This document describes the updated RAG (Retrieval-Augmented Generation) import feature that automatically triggers file processing after successful uploads.

## Overview

The RAG import feature has been enhanced to automatically trigger file processing after successful uploads using the backend Node.js service. This provides a seamless workflow where users upload files and processing begins immediately without additional manual steps.

**Note**: Authentication has been removed from the backend APIs for simplified development. All endpoints now require a `userId` parameter instead of authentication headers.

## Updated Workflow

### 1. File Upload
- Files are uploaded to the backend Node.js service via `/api/upload/upload`
- The backend service handles:
  - Uploading files to Azure Blob Storage
  - Creating RAG document records in Cosmos DB
  - Setting initial processing status

### 2. Automatic Processing Trigger
- After successful upload, the frontend automatically calls the processing API
- Processing endpoint: `/api/processing/process`
- The backend service:
  - Downloads the file from blob storage
  - Parses XML health data to health metrics
  - Saves health metrics to Cosmos DB
  - Updates RAG document status to processed

### 3. Progress Tracking
- Real-time progress updates during upload and processing
- Status indicators: `pending`, `uploading`, `processing`, `completed`, `failed`
- Error handling with detailed error messages

## Technical Implementation

### Frontend Changes

#### Updated RAG Store (`src/stores/rag.ts`)
The `processFiles` method now:
1. Imports the `nodeFileUploadService` 
2. Uploads files using the backend service
3. Automatically triggers processing via `processRAGDocument()`
4. Includes fallback to original Azure Function processing

```typescript
// Upload file to backend service
const uploadResult = await nodeFileUploadService.uploadFile(file, authStore.user.id, {
  sessionId: session.id,
  processingOptions: options
})

// Trigger file processing automatically after successful upload
await nodeFileUploadService.processRAGDocument(uploadResult.id, {
  batchSize: options.chunkSize || 512,
  transformOptions: options
})
```

#### Enhanced Upload Service (`src/services/nodeFileUploadService.ts`)
Added new methods:
- `processRAGDocument()` - Triggers file processing for a RAG document
- `getProcessingMetricsCount()` - Gets count of processed health metrics

### Backend Processing API

#### Process RAG Document
```
POST /api/processing/process
```

**Request Body:**
```json
{
  "ragDocumentId": "string",
  "userId": "string",
  "options": {
    "batchSize": 100,
    "timeout": 300000,
    "retryAttempts": 3,
    "transformOptions": {}
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": true,
  "message": "File processing job created successfully"
}
```

#### Get Metrics Count
```
GET /api/processing/metrics/count?userId=user123
```

**Query Parameters:**
- `userId` (required): User ID to get metrics count for

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 1250
  }
}
```

## Configuration

### Environment Variables

#### Frontend
```bash
# Backend service URL for file upload and processing
VITE_BACKEND_SERVICE_URL=http://localhost:3001/api
```

#### Backend
```bash
# Processing configuration
PROCESSING_BATCH_SIZE=100
PROCESSING_TIMEOUT=300000
PROCESSING_RETRY_ATTEMPTS=3
```

## Error Handling

### Fallback Mechanism
If the backend service is not available, the system automatically falls back to the original Azure Function processing:

```typescript
} catch (backendError) {
  console.warn('Backend service not available, falling back to original RAG processing:', backendError)
  
  // Fallback to original RAG processing
  const document = await RAGService.processDocument(file, userId, sessionId, options)
}
```

### Error Types
- **Upload Errors**: File upload failures, network issues
- **Processing Errors**: XML parsing failures, database errors
- **Backend Unavailable**: Service not running, network connectivity issues

## Supported File Types

The system supports the following file formats for health data processing:
- XML (Apple Health exports)
- CSV (health metrics data)
- JSON (structured health data)
- TXT (plain text health logs)

## Processing Options

Users can configure processing behavior:
- **Chunk Size**: Size of data chunks for processing (256, 512, 1024 tokens)
- **Chunk Overlap**: Overlap between chunks (0-200 tokens)
- **Generate Embeddings**: Enable semantic search capabilities
- **Preserve Formatting**: Maintain original document structure

## Benefits

1. **Seamless User Experience**: No manual processing trigger required
2. **Immediate Processing**: Files begin processing immediately after upload
3. **Progress Visibility**: Real-time updates on upload and processing status
4. **Fault Tolerance**: Automatic fallback to alternative processing methods
5. **Scalable**: Backend service can handle multiple concurrent uploads

## Usage Example

```typescript
// Upload and process files
await ragStore.processFiles(selectedFiles, {
  chunkSize: 512,
  chunkOverlap: 100,
  generateEmbeddings: true,
  preserveFormatting: false
})

// Files are automatically:
// 1. Uploaded to backend service
// 2. Saved to blob storage and database
// 3. Processed into health metrics
// 4. Available for search and analysis
```

## Monitoring

- Check processing status in the RAG Import page
- Monitor backend service health at `/api/processing/health`
- View processing metrics count for validation
- Error logs available in browser console and backend logs 