# Backend Service

A comprehensive backend service for the health monitor application that handles file uploads, processing, and other backend operations.

## Architecture

The backend service is organized into multiple services:

- **Upload Service**: Handles file uploads to Azure Blob Storage with support for single, batch, and chunked uploads
- **Processing Service**: Processes XML files from blob storage, transforms them to JSON, and stores health metrics in Cosmos DB
- **Shared Services**: Common services like Azure Blob Storage and Cosmos DB that are used across multiple services

## Features

### Upload Service
- Single file upload
- Batch file upload (up to 50 files)
- Chunked upload for large files
- Progress tracking
- File metadata management
- Azure Blob Storage integration

### Processing Service
- XML to JSON transformation (placeholder for your implementation)
- Health metrics storage in Cosmos DB
- Processing job management
- Background processing with status tracking
- Batch processing support

### Shared Services
- Azure Blob Storage service
- Azure Cosmos DB service
- Authentication middleware
- Common types and utilities

## Quick Start

### Prerequisites
- Node.js 18+
- Azure account with Blob Storage and Cosmos DB
- Environment variables configured

### Installation

1. Clone the repository and navigate to the backend service:
```bash
cd backend-service
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env
```

4. Configure your environment variables in `.env`

5. Start the development server:
```bash
npm run dev
```

The service will be available at `http://localhost:3001`

## Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER=health-files

# Azure Cosmos DB Configuration
AZURE_COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
AZURE_COSMOS_KEY=your-cosmos-key
AZURE_COSMOS_DATABASE=health-monitor
AZURE_COSMOS_CONTAINER_HEALTH_METRICS=health_metrics

# Authentication
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRES_IN=24h

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# File Upload Limits
MAX_FILE_SIZE=5368709120
MAX_FILES_PER_REQUEST=50
CHUNK_SIZE=5242880

# File Processing Configuration
PROCESSING_BATCH_SIZE=100
PROCESSING_TIMEOUT=300000
PROCESSING_RETRY_ATTEMPTS=3

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Upload Service
- `POST /api/upload/upload` - Single file upload
- `POST /api/upload/upload/batch` - Batch file upload
- `POST /api/upload/upload/chunked/init` - Initialize chunked upload
- `POST /api/upload/upload/chunked/chunk` - Upload chunk
- `POST /api/upload/upload/chunked/finalize` - Finalize chunked upload
- `GET /api/upload/upload/chunked/status/:sessionId` - Get upload status
- `DELETE /api/upload/upload/chunked/:sessionId` - Cancel upload
- `GET /api/upload/files` - List user files
- `GET /api/upload/files/:filePath` - Get file metadata
- `DELETE /api/upload/files/:filePath` - Delete file

### Processing Service
- `POST /api/processing/process` - Process XML file
- `GET /api/processing/jobs/:jobId` - Get processing job status
- `GET /api/processing/jobs` - List processing jobs
- `DELETE /api/processing/jobs/:jobId` - Delete processing job
- `GET /api/processing/metrics` - Get health metrics
- `DELETE /api/processing/metrics` - Delete health metrics
- `GET /api/processing/metrics/count` - Get metrics count
- `GET /api/processing/jobs/count` - Get jobs count
- `GET /api/processing/health` - Processing service health

## File Processing Implementation

The file processing service includes a placeholder for XML to JSON transformation. You need to implement the `parseXmlToHealthMetrics` method in `src/services/processing/fileProcessingService.ts`.

The method should:
1. Parse the XML content from the file buffer
2. Transform the XML data into health metric objects
3. Return an array of health metrics ready for storage in Cosmos DB

Example structure:
```typescript
private async parseXmlToHealthMetrics(
  fileBuffer: Buffer,
  userId: string,
  options: ProcessingOptions
): Promise<Omit<HealthMetric, 'id'>[]> {
  const xmlContent = fileBuffer.toString('utf-8')
  
  // TODO: Implement your XML parsing logic here
  // Use xml2js or your preferred XML parsing library
  
  const healthMetrics: Omit<HealthMetric, 'id'>[] = []
  
  // Transform your XML data into health metrics
  // Each metric should have: userId, metricType, value, unit, timestamp, source, _partitionKey
  
  return healthMetrics
}
```

## Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run type-check` - Run TypeScript type checking

### Service Development
- `npm run dev:upload` - Start upload service only
- `npm run dev:processing` - Start processing service only

## Docker

### Build and Run
```bash
# Build the image
docker build -t backend-service .

# Run the container
docker run -p 3001:3001 --env-file .env backend-service
```

### Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Project Structure

```
backend-service/
├── src/
│   ├── services/
│   │   ├── upload/                 # File upload service
│   │   │   ├── chunkedUploadService.ts
│   │   │   ├── routes/
│   │   │   │   └── upload.ts
│   │   │   └── index.ts
│   │   └── processing/             # File processing service
│   │       ├── fileProcessingService.ts
│   │       ├── routes/
│   │       │   └── processing.ts
│   │       └── index.ts
│   ├── shared/                     # Shared services and utilities
│   │   ├── services/
│   │   │   ├── azureBlobService.ts
│   │   │   └── azureCosmosService.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── types/
│   │       └── index.ts
│   └── index.ts                    # Main application entry point
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── setup.sh
└── README.md
```

## Contributing

1. Follow the existing code structure and patterns
2. Add proper error handling and logging
3. Include TypeScript types for all new functionality
4. Update documentation for new features
5. Add tests for new functionality

## License

This project is part of the health monitor application. 