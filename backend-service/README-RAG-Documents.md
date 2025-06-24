# RAG Documents Feature

This document describes the RAG (Retrieval-Augmented Generation) documents functionality that has been added to the upload service.

## Overview

When files are uploaded through the upload service, they are now automatically saved to the Cosmos DB `rag_documents` container with metadata for tracking processing status and document information.

## Database Schema

### RAGDocument Interface

```typescript
interface RAGDocument {
  id: string                    // Unique document ID (auto-generated)
  userId: string               // User who uploaded the document
  documentId: string           // Blob storage document ID
  documentFilePath: string     // Path to the file in blob storage
  isProcessed: boolean         // Processing status flag
  uploadDate: Date             // When the document was uploaded
  originalFileName?: string    // Original filename
  fileSize?: number           // File size in bytes
  contentType?: string        // MIME type of the file
  metadata?: Record<string, any> // Additional metadata
  _partitionKey: string       // Cosmos DB partition key (userId)
}
```

## API Endpoints

### Upload Endpoints (Updated)

All existing upload endpoints now automatically create RAG document entries:

- `POST /api/upload/upload` - Single file upload
- `POST /api/upload/upload/batch` - Batch file upload  
- `POST /api/upload/upload/chunked/finalize` - Chunked upload finalization

### New RAG Document Endpoints

#### Get RAG Documents
```
GET /api/upload/rag-documents
```

**Query Parameters:**
- `isProcessed` (optional): Filter by processing status (`true`/`false`)
- `limit` (optional): Maximum number of documents to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_user123_1234567890_abc123",
      "userId": "user123",
      "documentId": "blob-doc-456",
      "documentFilePath": "user123/1234567890-document.pdf",
      "isProcessed": false,
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "originalFileName": "document.pdf",
      "fileSize": 1024000,
      "contentType": "application/pdf",
      "metadata": {}
    }
  ]
}
```

#### Update Processing Status
```
PATCH /api/upload/rag-documents/:documentId/processing-status
```

**Request Body:**
```json
{
  "isProcessed": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_user123_1234567890_abc123",
    "userId": "user123",
    "documentId": "blob-doc-456",
    "documentFilePath": "user123/1234567890-document.pdf",
    "isProcessed": true,
    "uploadDate": "2024-01-15T10:30:00.000Z",
    "originalFileName": "document.pdf",
    "fileSize": 1024000,
    "contentType": "application/pdf",
    "metadata": {}
  }
}
```

## Cosmos DB Service Methods

The `AzureCosmosService` class now includes the following methods for RAG document management:

### Create RAG Document
```typescript
async createRAGDocument(document: Omit<RAGDocument, 'id' | '_partitionKey'>): Promise<RAGDocument>
```

### Get RAG Document
```typescript
async getRAGDocument(documentId: string, userId: string): Promise<RAGDocument | null>
```

### Get RAG Documents (with filtering)
```typescript
async getRAGDocuments(
  userId: string,
  options: {
    isProcessed?: boolean
    limit?: number
  } = {}
): Promise<RAGDocument[]>
```

### Update RAG Document
```typescript
async updateRAGDocument(
  documentId: string,
  userId: string,
  updates: Partial<Omit<RAGDocument, 'id' | 'userId' | '_partitionKey'>>
): Promise<RAGDocument>
```

### Delete RAG Document
```typescript
async deleteRAGDocument(documentId: string, userId: string): Promise<void>
```

### Get RAG Documents Count
```typescript
async getRAGDocumentsCount(userId: string, isProcessed?: boolean): Promise<number>
```

## Database Container

The `rag_documents` container is automatically created during service initialization with the following configuration:

- **Container Name**: `rag_documents`
- **Partition Key**: `/userId`
- **Database**: Same as other containers (default: `health-monitor`)

## Usage Examples

### Frontend Integration

```javascript
// Get all documents for a user
const response = await fetch('/api/upload/rag-documents', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const documents = await response.json();

// Get only unprocessed documents
const unprocessedResponse = await fetch('/api/upload/rag-documents?isProcessed=false', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const unprocessedDocs = await unprocessedResponse.json();

// Update processing status
const updateResponse = await fetch(`/api/upload/rag-documents/${documentId}/processing-status`, {
  method: 'PATCH',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ isProcessed: true })
});
```

### Processing Pipeline Integration

```javascript
// After processing a document, update its status
await azureCosmosService.updateRAGDocument(
  documentId,
  userId,
  { isProcessed: true }
);

// Get documents that need processing
const unprocessedDocs = await azureCosmosService.getRAGDocuments(userId, {
  isProcessed: false
});
```

## Testing

Run the test script to verify functionality:

```bash
node test-rag-documents.js
```

## Environment Variables

No additional environment variables are required. The RAG documents feature uses the same Cosmos DB configuration as the existing health metrics:

- `AZURE_COSMOS_ENDPOINT`
- `AZURE_COSMOS_KEY`
- `AZURE_COSMOS_DATABASE` (optional, defaults to `health-monitor`)

## Error Handling

All RAG document operations include proper error handling and will return appropriate HTTP status codes:

- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (missing or invalid authentication)
- `404` - Document not found
- `500` - Internal server error

## Migration Notes

This feature is backward compatible and doesn't require any changes to existing upload functionality. All existing upload endpoints will continue to work as before, with the addition of automatic RAG document creation. 