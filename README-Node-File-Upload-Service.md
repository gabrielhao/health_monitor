# Node.js File Upload Service Solution

## Overview

This document describes the solution for addressing the Azure Blob Storage browser-side limitations by creating a dedicated Node.js service that handles file uploads server-side. This approach provides better security, performance, and reliability for file uploads in the health monitor application.

## Problem Statement

The existing implementation faces several challenges with Azure Blob Storage in browser environments:

1. **Browser Limitations**: Azure Blob Storage JavaScript SDK works better on Node.js than in browsers
2. **Security Concerns**: Exposing Azure connection strings in browser code
3. **Performance Issues**: Large file uploads can be problematic in browsers
4. **CORS Complexity**: Managing CORS policies for direct Azure Blob access

## Solution Architecture

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Node.js Service   │    │   Azure Blob    │
│   (Vue.js)      │───▶│   (Express.js)      │───▶│   Storage       │
│                 │    │                     │    │                 │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
```

### Key Benefits

1. **Enhanced Security**: Azure credentials stay on the server
2. **Better Performance**: Server-side processing for large files
3. **Improved Reliability**: Better error handling and retry logic
4. **Simplified Frontend**: Cleaner browser-side code
5. **Flexible Architecture**: Easy to switch between providers

## Implementation

### 1. Node.js File Upload Service

The service is located in the `file-upload-service/` directory and provides:

- **Express.js Server**: RESTful API endpoints
- **Azure Blob Integration**: Server-side Azure Blob Storage operations
- **Chunked Uploads**: Support for large files with progress tracking
- **Authentication**: JWT-based authentication
- **Rate Limiting**: Configurable rate limiting
- **CORS Support**: Configurable CORS policies
- **Error Handling**: Comprehensive error handling and logging

### 2. Frontend Integration

The existing `FileUploadAdapter` has been extended to support the new Node.js service:

```typescript
// New provider type
export type UploadProvider = 'azure' | 'external' | 'node'

// Updated adapter with Node.js service support
import { nodeFileUploadService } from './nodeFileUploadService'
```

### 3. Configuration

#### Environment Variables

**Frontend (.env.local)**:
```env
# Node.js Upload Service Configuration
VITE_NODE_UPLOAD_API_URL=http://localhost:3001/api
VITE_UPLOAD_PROVIDER=node
VITE_UPLOAD_FALLBACK_PROVIDER=azure

# File Upload Limits
VITE_MAX_FILE_SIZE=5368709120
VITE_ALLOWED_FILE_TYPES=image/jpeg,application/pdf,text/plain
```

**Backend (file-upload-service/.env)**:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER=health-files

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# File Upload Limits
MAX_FILE_SIZE=5368709120
MAX_FILES_PER_REQUEST=50
CHUNK_SIZE=5242880

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Installation and Setup

### 1. Quick Setup

```bash
# Navigate to the file upload service directory
cd file-upload-service

# Run the setup script
./setup.sh

# Edit the .env file with your configuration
nano .env

# Start the service
npm run dev
```

### 2. Manual Setup

```bash
# Install dependencies
npm install

# Create environment file
cp env.example .env

# Edit configuration
nano .env

# Build the service
npm run build

# Start the service
npm start
```

### 3. Docker Setup

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t file-upload-service .
docker run -p 3001:3001 --env-file .env file-upload-service
```

## API Endpoints

### Authentication
All endpoints require a valid JWT token:
```
Authorization: Bearer <your-jwt-token>
```

### File Upload Endpoints

#### Single File Upload
```http
POST /api/upload
Content-Type: multipart/form-data

Form fields:
- file: File blob
- userId: string (optional)
- metadata: JSON string (optional)
```

#### Batch File Upload
```http
POST /api/upload/batch
Content-Type: multipart/form-data

Form fields:
- files: File blobs (multiple)
- userId: string (optional)
- metadata: JSON string (optional)
```

#### Chunked Upload (Large Files)
```http
# Initialize
POST /api/upload/chunked/init
Content-Type: application/json

{
  "fileName": "user123/file.zip",
  "contentType": "application/zip",
  "fileSize": 104857600,
  "chunkSize": 5242880,
  "metadata": {}
}

# Upload chunks
POST /api/upload/chunked/chunk
Content-Type: multipart/form-data

Form fields:
- chunk: File blob
- sessionId: string
- chunkIndex: number

# Finalize
POST /api/upload/chunked/finalize
Content-Type: application/json

{
  "sessionId": "session_1234567890_abc123"
}
```

#### File Management
```http
# Get upload status
GET /api/upload/status/:sessionId

# Cancel upload
DELETE /api/upload/cancel/:sessionId

# Delete file
DELETE /api/files/:fileId

# Get file metadata
GET /api/files/:fileId/metadata

# Health check
GET /api/health
```

## Integration with Existing Code

### 1. Update Frontend Configuration

The existing `FileUploadAdapter` automatically supports the new Node.js service:

```typescript
// The adapter will use the Node.js service when configured
const result = await fileUploadAdapter.uploadFile(file, userId, {
  provider: 'node' // or set via VITE_UPLOAD_PROVIDER
})
```

### 2. Migration from Azure Blob Direct

**Before (Direct Azure Blob)**:
```typescript
import { azureBlob } from '@/services/azureBlob'

const result = await azureBlob.uploadFile(file, userId, path)
```

**After (Node.js Service)**:
```typescript
import { fileUploadAdapter } from '@/services/fileUploadAdapter'

const result = await fileUploadAdapter.uploadFile(file, userId, path, {
  provider: 'node'
})
```

### 3. Fallback Configuration

The adapter supports automatic fallback between providers:

```typescript
// If Node.js service fails, fallback to Azure
const result = await fileUploadAdapter.uploadFile(file, userId, {
  provider: 'node',
  fallbackProvider: 'azure'
})
```

## Features

### 1. Chunked Uploads
- **Automatic Detection**: Files >5MB are automatically chunked
- **Progress Tracking**: Real-time progress updates
- **Resume Capability**: Failed chunks can be retried
- **Memory Efficient**: Processes chunks without loading entire file

### 2. Batch Uploads
- **Multiple Files**: Upload up to 50 files simultaneously
- **Individual Progress**: Track progress for each file
- **Error Handling**: Continue processing if some files fail

### 3. Security
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent abuse with configurable limits
- **CORS Protection**: Restrict access to authorized origins
- **Input Validation**: Comprehensive validation of all inputs

### 4. Monitoring
- **Health Checks**: Built-in health monitoring
- **Logging**: Comprehensive request/response logging
- **Error Tracking**: Detailed error information
- **Performance Metrics**: Upload speed and success rates

## Performance Considerations

### 1. Large File Handling
- **Chunked Processing**: Files are processed in 5MB chunks
- **Memory Management**: Efficient memory usage for large files
- **Streaming**: File streams are processed without loading into memory

### 2. Concurrent Uploads
- **Session Management**: Each upload gets a unique session
- **Resource Limits**: Configurable limits prevent server overload
- **Queue Management**: Automatic cleanup of expired sessions

### 3. Network Optimization
- **Compression**: Automatic compression for supported file types
- **Retry Logic**: Exponential backoff for failed requests
- **Timeout Handling**: Configurable timeouts for different operations

## Troubleshooting

### Common Issues

1. **Service Won't Start**:
   ```bash
   # Check Node.js version
   node --version
   
   # Check environment variables
   cat .env
   
   # Check logs
   npm run dev
   ```

2. **Azure Connection Failed**:
   ```bash
   # Verify connection string
   echo $AZURE_STORAGE_CONNECTION_STRING
   
   # Test Azure connectivity
   curl -X GET "https://your-storage-account.blob.core.windows.net/?restype=service&comp=properties"
   ```

3. **CORS Errors**:
   ```bash
   # Check allowed origins
   echo $ALLOWED_ORIGINS
   
   # Test CORS
   curl -H "Origin: http://localhost:5173" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: authorization" \
        -X OPTIONS http://localhost:3001/api/upload
   ```

4. **Authentication Errors**:
   ```bash
   # Check JWT secret
   echo $JWT_SECRET
   
   # Verify token format
   # Token should be a valid JWT token from your auth system
   ```

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm run dev
```

### Health Check

Test service health:
```bash
curl http://localhost:3001/api/health
```

## Deployment

### 1. Production Deployment

```bash
# Build for production
npm run build

# Set production environment
NODE_ENV=production npm start
```

### 2. Docker Deployment

```bash
# Build image
docker build -t file-upload-service .

# Run container
docker run -d \
  --name file-upload-service \
  -p 3001:3001 \
  --env-file .env \
  file-upload-service
```

### 3. Environment Variables for Production

```env
NODE_ENV=production
PORT=3001
AZURE_STORAGE_CONNECTION_STRING=your-production-connection-string
JWT_SECRET=your-production-jwt-secret
ALLOWED_ORIGINS=https://yourdomain.com
```

## Monitoring and Maintenance

### 1. Health Monitoring
- **Health Endpoint**: `/api/health` for load balancer health checks
- **Metrics**: Active sessions, upload counts, error rates
- **Logs**: Request/response logging for debugging

### 2. Maintenance Tasks
- **Session Cleanup**: Expired sessions are automatically cleaned up
- **Log Rotation**: Implement log rotation for production
- **Backup**: Regular backups of configuration and logs

### 3. Scaling Considerations
- **Horizontal Scaling**: Multiple instances behind a load balancer
- **Session Storage**: Consider Redis for session storage in multi-instance setup
- **File Limits**: Adjust file size and count limits based on server capacity

## Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **JWT Secrets**: Use strong, unique secrets for JWT signing
3. **CORS Configuration**: Restrict origins to only necessary domains
4. **Rate Limiting**: Configure appropriate rate limits for your use case
5. **Input Validation**: Validate all inputs on both client and server
6. **HTTPS**: Use HTTPS in production for all communications

## Conclusion

This Node.js file upload service provides a robust, secure, and scalable solution for handling file uploads in the health monitor application. It addresses the limitations of browser-side Azure Blob Storage while maintaining compatibility with the existing codebase.

The solution offers:
- **Better Security**: Server-side credential management
- **Improved Performance**: Optimized for large file uploads
- **Enhanced Reliability**: Comprehensive error handling and retry logic
- **Easy Integration**: Drop-in replacement for existing upload services
- **Flexible Architecture**: Support for multiple upload providers

For questions or issues, refer to the troubleshooting section or check the service logs for detailed error information. 