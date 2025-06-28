# Embedding Service

The Embedding Service is responsible for processing Apple Health XML files and generating vector embeddings for semantic search and RAG (Retrieval-Augmented Generation) capabilities.

## Overview

This service transforms the Azure Function implementation into a backend REST API service that:

1. **Processes Apple Health XML files** - Parses XML data from RAG documents stored in Azure Blob Storage
2. **Generates semantic chunks** - Groups health records into meaningful chunks for embedding
3. **Creates vector embeddings** - Uses Azure OpenAI to generate embeddings for health data
4. **Stores in Cosmos DB** - Saves embedding documents for vector search capabilities

## Architecture

The service follows the same pattern as other backend services:

```
backend-service/src/services/embedding/
├── fileEmbeddingServices.ts    # Main service class
├── routes/
│   └── embedding.ts            # REST API endpoints
└── index.ts                   # Service initialization
```

## Key Features

### 1. XML Processing
- Parses Apple Health XML files using fast-xml-parser
- Validates XML structure and extracts health records
- Supports all Apple Health record types (HKQuantityType, HKCategoryType, etc.)

### 2. Intelligent Chunking
- Groups related health records into semantic chunks
- Configurable chunk size (default: 15 records per chunk)
- Maintains chronological order and context

### 3. Embedding Generation
- Uses Azure OpenAI's text-embedding-ada-002 model
- 1536-dimensional embeddings optimized for health data
- Batched processing to handle rate limits

### 4. Data Storage
- Stores embedding documents in Cosmos DB
- Partitioned by user_id for optimal performance
- Includes original health record metadata

## API Endpoints

### Process Document Embeddings
```http
POST /api/embedding/process
Content-Type: application/json

{
  "ragDocumentId": "document-id",
  "userId": "user-id",
  "options": {
    "batchSize": 5,
    "maxChunkSize": 15,
    "maxTextLength": 8000
  }
}
```

### Generate Embedding (Utility)
```http
POST /api/embedding/generate
Content-Type: application/json

{
  "text": "Health data to embed",
  "options": {
    "maxTextLength": 8000
  }
}
```

### Get Embedding Documents
```http
GET /api/embedding/documents?userId=user-id&documentId=doc-id&limit=100
```

### Delete Embedding Documents
```http
DELETE /api/embedding/documents
Content-Type: application/json

{
  "userId": "user-id",
  "documentId": "doc-id" // optional
}
```

### Health Check
```http
GET /api/embedding/health
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai-instance.openai.azure.com
AZURE_OPENAI_KEY=your-openai-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-ada-002

# Cosmos DB Configuration (existing + new container)
AZURE_COSMOS_CONTAINER_HEALTH_EMBEDDINGS=health_embeddings
```

### Default Constants

- **Embedding Model**: text-embedding-ada-002
- **Max Text Length**: 8,000 characters
- **Max Chunk Size**: 15 health records
- **Batch Size**: 5 chunks processed simultaneously

## Data Flow

1. **Input**: RAG document ID referencing XML file in Azure Blob Storage
2. **Download**: Fetch XML content from blob storage
3. **Parse**: Extract Apple Health records from XML
4. **Chunk**: Group records into semantic chunks
5. **Embed**: Generate vector embeddings for each chunk
6. **Store**: Save embedding documents to Cosmos DB

## Health Record Processing

### Supported Types
- HKQuantityTypeIdentifier (steps, heart rate, etc.)
- HKCategoryTypeIdentifier (sleep analysis, etc.)
- HKCorrelationTypeIdentifier (blood pressure, etc.)
- HKWorkoutTypeIdentifier (workouts)

### Record Formatting
Each record is formatted for optimal embedding:
```
heart rate: 72 count/min recorded from 2023-01-01 10:00:00 to 2023-01-01 10:00:00 via Apple Watch
```

## Error Handling

The service includes comprehensive error handling for:
- Missing or invalid XML files
- Azure OpenAI API limits and failures
- Cosmos DB connection issues
- Invalid health record formats

## Performance Considerations

- **Batched Processing**: Processes multiple chunks simultaneously
- **Rate Limiting**: Respects Azure OpenAI rate limits
- **Chunking Strategy**: Optimized for both context and token limits
- **Partitioning**: Cosmos DB partitioned by user_id for scalability

## Integration with Other Services

### Processing Service
The embedding service can be called after the processing service completes health metric extraction.

### Vector Search
Embedding documents can be used for:
- Semantic search of health data
- RAG-based health insights
- Similar health pattern detection

## Migration from Azure Function

This service replaces the Azure Function implementation with these improvements:

1. **REST API**: Direct HTTP endpoints instead of blob triggers
2. **Better Error Handling**: Comprehensive error responses
3. **Flexible Configuration**: Runtime configuration options
4. **Service Integration**: Works with existing backend services
5. **Health Monitoring**: Built-in health check endpoints

## Usage Example

```typescript
// Process embeddings for a RAG document
const response = await fetch('/api/embedding/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ragDocumentId: 'doc-123',
    userId: 'user-456',
    options: {
      maxChunkSize: 20,
      batchSize: 3
    }
  })
});

const result = await response.json();
console.log(`Processed ${result.data.processedChunks} chunks with ${result.data.totalRecords} records`);
``` 