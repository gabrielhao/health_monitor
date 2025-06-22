# Azure Migration Guide - Cosmos DB Implementation

This guide details the migration from Supabase to Azure Cosmos DB for the Health Monitor application.

## Overview

The Health Monitor application has been migrated from Supabase (PostgreSQL + pgvector) to Azure Cosmos DB (NoSQL database with built-in global distribution). This migration provides:

- **Scalability**: Automatic horizontal scaling
- **Global Distribution**: Multi-region replication
- **Flexibility**: Schema-less NoSQL document storage
- **Azure Integration**: Native integration with other Azure services
- **Cost Optimization**: Pay-per-use model with automatic scaling

## Architecture Changes

### Database Layer
- **From**: Supabase PostgreSQL with pgvector extension
- **To**: Azure Cosmos DB with SQL API
- **Storage Model**: Relational tables → NoSQL document collections (containers)
- **Vector Search**: Custom cosine similarity implementation (future: Azure Cognitive Search integration)

### Key Components

1. **Azure Cosmos DB Account**: Global database service
2. **Database**: HealthMonitorDB
3. **Containers**: Document collections with partition keys
4. **Azure Blob Storage**: File storage (unchanged)
5. **Azure Functions**: Serverless processing (updated)
6. **Azure AD**: Authentication (unchanged)

## Prerequisites

- Azure CLI installed and configured
- Node.js 18+ with npm
- Git for version control
- Valid Azure subscription

## Quick Setup

Run the automated setup script:

```bash
chmod +x azure-setup.sh
./azure-setup.sh
```

This script will:
1. Create Azure resource group
2. Create Cosmos DB account and database
3. Create all required containers
4. Set up blob storage
5. Configure Azure Functions
6. Generate environment configuration

## Manual Setup

If you prefer manual setup or need to customize resources:

### 1. Create Resource Group

```bash
az group create \
  --name rg-health-monitor \
  --location westeurope
```

### 2. Create Cosmos DB Account

```bash
az cosmosdb create \
  --name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --location westeurope \
  --kind GlobalDocumentDB \
  --default-consistency-level Session \
  --enable-automatic-failover true
```

### 3. Create Database

```bash
az cosmosdb sql database create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --name HealthMonitorDB
```

### 4. Create Containers

```bash
# Health Documents Container
az cosmosdb sql container create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name health_documents \
  --partition-key-path /user_id \
  --throughput 400

# Health Embeddings Container
az cosmosdb sql container create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name health_embeddings \
  --partition-key-path /user_id \
  --throughput 400

# Import Sessions Container
az cosmosdb sql container create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name import_sessions \
  --partition-key-path /user_id \
  --throughput 400

# RAG Documents Container
az cosmosdb sql container create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name rag_documents \
  --partition-key-path /user_id \
  --throughput 400

# RAG Chunks Container
az cosmosdb sql container create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name rag_chunks \
  --partition-key-path /user_id \
  --throughput 400

# User Profiles Container
az cosmosdb sql container create \
  --account-name cosmos-health-monitor-[UNIQUE-ID] \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name user_profiles \
  --partition-key-path /id \
  --throughput 400
```

## Configuration

### Environment Variables

Create `.env.local` file:

```env
# Azure Active Directory
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id

# Azure Cosmos DB
VITE_AZURE_COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
VITE_AZURE_COSMOS_KEY=your-cosmos-primary-key
VITE_AZURE_COSMOS_DATABASE=HealthMonitorDB

# Azure Blob Storage
VITE_AZURE_STORAGE_ACCOUNT=your-storage-account
VITE_AZURE_STORAGE_CONTAINER=health-files

# OpenAI API
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_OPENAI_MODEL=text-embedding-3-small
VITE_OPENAI_DIMENSIONS=1536
```

### Service Integration

Update your application code to use the new Cosmos DB service:

```typescript
import { azureCosmos } from './services/azureCosmos'
import { azureVectorService } from './services/azureVectorService'

// Initialize services
await azureCosmos.initialize()

// Create health documents
const document = await azureVectorService.createHealthDocument(
  userId,
  'Blood Pressure Reading',
  JSON.stringify(healthData),
  'apple_health',
  'vital_signs'
)

// Search similar content
const results = await azureVectorService.searchSimilarContent(
  queryEmbedding,
  userId,
  { threshold: 0.8, limit: 10 }
)
```

## Data Migration

### From Supabase to Cosmos DB

1. **Export Supabase Data**:
```bash
# Export existing data
supabase db dump --file=backup.sql
```

2. **Transform Data Structure**:
The migration requires transforming relational data to document format:

```typescript
// Before (Supabase/PostgreSQL)
const healthDocument = {
  id: 'uuid',
  user_id: 'uuid',
  title: 'string',
  content: 'text',
  metadata: JSON // stored as JSONB
}

// After (Cosmos DB)
const healthDocument = {
  id: 'string',
  user_id: 'string',
  title: 'string',
  content: 'text',
  metadata: {}, // native object
  _partitionKey: 'user_id', // Cosmos DB partition key
  created_at: Date,
  // ... other fields
}
```

3. **Migrate Vector Embeddings**:
```typescript
// Vector embeddings are now stored as number arrays instead of binary
const embedding = {
  embedding: [0.1, 0.2, 0.3, ...], // number[] instead of Buffer
  // ... other fields
}
```

## Container Schema

### Health Documents Container
```json
{
  "id": "string",
  "user_id": "string",
  "source_app": "string",
  "document_type": "string",
  "title": "string",
  "content": "string",
  "metadata": {},
  "file_path": "string?",
  "import_session_id": "string?",
  "processed_at": "Date?",
  "created_at": "Date",
  "_partitionKey": "user_id"
}
```

### Health Embeddings Container
```json
{
  "id": "string",
  "user_id": "string",
  "document_id": "string",
  "content_chunk": "string",
  "embedding": "number[]",
  "chunk_index": "number",
  "metadata": {},
  "created_at": "Date",
  "_partitionKey": "user_id"
}
```

## Performance Optimization

### Partition Strategy
- **Health Documents**: Partitioned by `user_id`
- **Health Embeddings**: Partitioned by `user_id`
- **User Profiles**: Partitioned by `id` (user ID)
- **Import Sessions**: Partitioned by `user_id`

### Query Optimization
```typescript
// Efficient queries (within partition)
const userDocuments = await container.items
  .query({
    query: 'SELECT * FROM c WHERE c.user_id = @userId',
    parameters: [{ name: '@userId', value: userId }]
  }, { partitionKey: userId })
  .fetchAll()

// Cross-partition queries (avoid when possible)
const allDocuments = await container.items
  .query('SELECT * FROM c')
  .fetchAll()
```

### Throughput Configuration
- **Development**: 400 RU/s per container (auto-scale)
- **Production**: Start with 1000 RU/s, monitor and adjust
- **High-traffic**: Enable auto-scale with max 4000 RU/s

## Vector Search Considerations

### Current Implementation
- Custom cosine similarity calculation
- In-memory vector comparison
- Suitable for small to medium datasets

### Future Enhancement: Azure Cognitive Search
For production vector search at scale:

```typescript
// Future implementation with Azure Cognitive Search
import { SearchClient } from '@azure/search-documents'

const searchClient = new SearchClient(
  'https://your-search-service.search.windows.net',
  'health-vectors-index',
  credential
)

const results = await searchClient.search('*', {
  vectors: [{
    value: queryEmbedding,
    kNearestNeighborsCount: 10,
    fields: ['embedding']
  }]
})
```

## Monitoring and Diagnostics

### Azure Portal Monitoring
- **Metrics**: Request units, latency, availability
- **Logs**: Query execution, errors, performance
- **Alerts**: Configure for high RU consumption or errors

### Application Monitoring
```typescript
// Custom health check
const healthStatus = await azureCosmos.healthCheck()
console.log('Database status:', healthStatus)

// Performance monitoring
const startTime = Date.now()
const result = await azureVectorService.searchSimilarContent(...)
const duration = Date.now() - startTime
console.log(`Search completed in ${duration}ms`)
```

## Cost Optimization

### Strategies
1. **Right-size Throughput**: Start small, scale based on usage
2. **Optimize Queries**: Use partition keys effectively
3. **Data Lifecycle**: Archive old data to cheaper storage
4. **Indexing**: Use selective indexing for better performance

### Estimated Costs (West Europe)
- **Development**: ~$24/month (400 RU/s per container)
- **Production**: ~$60-200/month (1000-4000 RU/s)
- **Storage**: ~$0.25/GB/month

## Security

### Access Control
- Connection secured with primary/secondary keys
- Role-based access control (RBAC) via Azure AD
- Network security with VNet integration

### Best Practices
```typescript
// Use environment variables for sensitive data
const client = new CosmosClient({
  endpoint: process.env.VITE_AZURE_COSMOS_ENDPOINT,
  key: process.env.VITE_AZURE_COSMOS_KEY
})

// Implement proper error handling
try {
  const result = await container.items.create(document)
} catch (error) {
  if (error.code === 409) {
    // Handle conflict (document already exists)
  } else if (error.code === 429) {
    // Handle rate limiting
  }
  throw error
}
```

## Troubleshooting

### Common Issues

1. **Connection Errors**:
   - Verify endpoint URL and access keys
   - Check firewall settings
   - Ensure proper network connectivity

2. **Performance Issues**:
   - Monitor RU consumption
   - Optimize queries with partition keys
   - Consider indexing strategy

3. **Vector Search Accuracy**:
   - Verify embedding dimensions match
   - Check similarity threshold settings
   - Consider data normalization

### Debug Commands

```bash
# Test Cosmos DB connection
az cosmosdb show --name your-cosmos-account --resource-group rg-health-monitor

# Check container throughput
az cosmosdb sql container throughput show \
  --account-name your-cosmos-account \
  --resource-group rg-health-monitor \
  --database-name HealthMonitorDB \
  --name health_documents

# Monitor metrics
az monitor metrics list \
  --resource "/subscriptions/{subscription-id}/resourceGroups/rg-health-monitor/providers/Microsoft.DocumentDB/databaseAccounts/your-cosmos-account" \
  --metric "TotalRequestUnits"
```

## Next Steps

1. **Deploy the Application**: Build and deploy to Azure App Service
2. **Set up CI/CD**: Configure Azure DevOps or GitHub Actions
3. **Monitor Performance**: Set up Application Insights
4. **Implement Caching**: Add Redis cache for frequently accessed data
5. **Enhance Vector Search**: Integrate Azure Cognitive Search for production

## Support

For issues or questions:
- Check Azure Cosmos DB documentation
- Review application logs in Azure Portal
- Contact the development team
- Create GitHub issues for bug reports

---

**Migration completed successfully! Your Health Monitor application now runs on Azure Cosmos DB with improved scalability and global distribution capabilities.** 