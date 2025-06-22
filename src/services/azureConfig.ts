import { PublicClientApplication } from '@azure/msal-browser'
import { BlobServiceClient } from '@azure/storage-blob'
import { ClientSecretCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import { CosmosClient } from '@azure/cosmos'
import { OpenAI } from 'openai'

// Azure configuration
const azureConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    // For Entra External ID, use the correct authority format
    authority: import.meta.env.VITE_AZURE_AUTHORITY || 
      (import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN ? 
        `https://${import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN}/${import.meta.env.VITE_AZURE_TENANT_ID}` :
        `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`),
    redirectUri: window.location.origin,
    scopes: ['https://graph.microsoft.com/User.Read'],
    // Additional configuration for External ID
    knownAuthorities: import.meta.env.VITE_AZURE_KNOWN_AUTHORITIES ? 
      import.meta.env.VITE_AZURE_KNOWN_AUTHORITIES.split(',') : 
      (import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN ? [import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN] : undefined)
  },
  services: {
    // Service principal credentials for accessing Azure services
    clientId: import.meta.env.VITE_AZURE_SERVICE_CLIENT_ID,
    tenantId: import.meta.env.VITE_AZURE_SERVICE_TENANT_ID,
    clientSecret: import.meta.env.VITE_AZURE_SERVICE_CLIENT_SECRET
  },
  storage: {
    accountName: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT,
    containerName: import.meta.env.VITE_AZURE_STORAGE_CONTAINER || 'health-files',
    connectionString: import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING
  },
  cosmosDb: {
    endpoint: import.meta.env.VITE_AZURE_COSMOS_ENDPOINT,
    key: import.meta.env.VITE_AZURE_COSMOS_KEY,
    databaseId: import.meta.env.VITE_AZURE_COSMOS_DATABASE || 'HealthMonitorDB',
    containers: {
      healthDocuments: 'health_documents',
      healthEmbeddings: 'health_embeddings',
      importSessions: 'import_sessions',
      dataSources: 'data_sources',
      ragDocuments: 'rag_documents',
      ragChunks: 'rag_chunks',
      ragImportSessions: 'rag_import_sessions',
      userProfiles: 'user_profiles',
      healthMetrics: 'health_metrics',
      chatMessages: 'chat_messages',
      analyticsData: 'analytics_data'
    }
  },
  keyVault: {
    vaultUrl: import.meta.env.VITE_AZURE_KEYVAULT_URL
  },
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    dimensions: 1536
  }
}

// Validate required environment variables
const requiredEnvVars = [
  'VITE_AZURE_CLIENT_ID',
  'VITE_AZURE_TENANT_ID',
  'VITE_AZURE_SERVICE_CLIENT_ID',
  'VITE_AZURE_SERVICE_TENANT_ID',
  'VITE_AZURE_SERVICE_CLIENT_SECRET',
  'VITE_AZURE_STORAGE_CONNECTION_STRING',
  'VITE_AZURE_COSMOS_ENDPOINT',
  'VITE_AZURE_COSMOS_KEY',
  'VITE_OPENAI_API_KEY'
]

for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}

// Initialize MSAL instance for authentication
export const msalInstance = new PublicClientApplication({
  auth: azureConfig.auth,
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  }
})

// Initialize Azure Blob Storage client
export const createBlobServiceClient = async (): Promise<BlobServiceClient> => {
  // Using connection string - secure and simple approach for storage
  return BlobServiceClient.fromConnectionString(azureConfig.storage.connectionString!)
}

// Initialize Azure Cosmos DB client
export const createCosmosClient = (): CosmosClient => {
  return new CosmosClient({
    endpoint: azureConfig.cosmosDb.endpoint,
    key: azureConfig.cosmosDb.key
  })
}

// Initialize Azure Key Vault client
export const createKeyVaultClient = (): SecretClient => {
  // WARNING: Using client secret in browser is not secure for production
  // Consider using a backend service or Azure Functions for service-to-service auth
  const credential = new ClientSecretCredential(
    azureConfig.services.tenantId!,
    azureConfig.services.clientId!,
    azureConfig.services.clientSecret!
  )
  return new SecretClient(azureConfig.keyVault.vaultUrl, credential)
}

// Initialize OpenAI client
export const openaiClient = new OpenAI({
  apiKey: azureConfig.openai.apiKey,
  dangerouslyAllowBrowser: true // Only for development - use server-side in production
})

export { azureConfig }

// Database type helpers for Azure Cosmos DB
export interface CosmosDatabase {
  user_profiles: UserProfile
  health_documents: HealthDocument
  health_embeddings: HealthEmbedding
  import_sessions: ImportSession
  data_sources: DataSource
  rag_documents: RagDocument
  rag_chunks: RagChunk
  rag_import_sessions: RagImportSession
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  date_of_birth?: string
  gender?: string
  height?: number
  weight?: number
  emergency_contact?: string
  medical_conditions?: Record<string, any>
  medications?: Record<string, any>
  privacy_settings?: Record<string, any>
  created_at: Date
  updated_at: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface HealthDocument {
  id: string
  user_id: string
  source_app: string
  document_type: string
  title: string
  content: string
  metadata?: Record<string, any>
  file_path?: string
  import_session_id?: string
  processed_at?: Date
  created_at: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface HealthEmbedding {
  id: string
  user_id: string
  document_id: string
  content_chunk: string
  embedding: number[]
  chunk_index: number
  metadata?: Record<string, any>
  created_at: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface ImportSession {
  id: string
  user_id: string
  source_app: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_records: number
  processed_records: number
  failed_records: number
  error_log?: string[]
  metadata?: Record<string, any>
  started_at: Date
  completed_at?: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface DataSource {
  id: string
  user_id: string
  source_type: string
  source_name: string
  is_active: boolean
  last_sync_at?: Date
  sync_frequency: 'manual' | 'daily' | 'weekly'
  auth_token_encrypted?: string
  configuration?: Record<string, any>
  created_at: Date
  updated_at: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface RagDocument {
  id: string
  user_id: string
  filename: string
  file_type: string
  file_size: number
  content: string
  status: 'processing' | 'completed' | 'failed'
  error_message?: string
  chunk_count: number
  embedding_count: number
  metadata?: Record<string, any>
  created_at: Date
  updated_at: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface RagChunk {
  id: string
  document_id: string
  user_id: string
  content: string
  embedding?: number[]
  chunk_index: number
  token_count: number
  metadata?: Record<string, any>
  created_at: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
}

export interface RagImportSession {
  id: string
  user_id: string
  total_files: number
  processed_files: number
  failed_files: number
  total_chunks: number
  total_embeddings: number
  status: 'processing' | 'completed' | 'failed'
  error_log?: string[]
  started_at: Date
  completed_at?: Date
  _partitionKey: string // Cosmos DB partition key - using user_id
} 