import { CosmosClient } from '@azure/cosmos';
import { ClientSecretCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { PublicClientApplication } from '@azure/msal-browser';
import { BlobServiceClient } from '@azure/storage-blob';
import { OpenAI } from 'openai';
import type { UserProfile, HealthDocument, HealthEmbedding, ImportSession, DataSource } from '@/types/index';
import type { RAGDocument, RAGChunk, RAGImportSession } from '@/types/rag';

// Azure configuration
const azureConfig = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
        // For Entra External ID, use the correct authority format
        authority:
            import.meta.env.VITE_AZURE_AUTHORITY ||
            (import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN
                ? `https://${import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN}/${import.meta.env.VITE_AZURE_TENANT_ID}`
                : `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`),
        redirectUri: window.location.origin,
        scopes: ['https://graph.microsoft.com/User.Read'],
        // Additional configuration for External ID
        knownAuthorities: import.meta.env.VITE_AZURE_KNOWN_AUTHORITIES
            ? import.meta.env.VITE_AZURE_KNOWN_AUTHORITIES.split(',')
            : import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN
              ? [import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN]
              : undefined,
    },
    services: {
        // Service principal credentials for accessing Azure services
        clientId: import.meta.env.VITE_AZURE_SERVICE_CLIENT_ID,
        tenantId: import.meta.env.VITE_AZURE_SERVICE_TENANT_ID,
        clientSecret: import.meta.env.VITE_AZURE_SERVICE_CLIENT_SECRET,
    },
    storage: {
        accountName: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT,
        containerName: import.meta.env.VITE_AZURE_STORAGE_CONTAINER || 'health-files',
        connectionString: import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING,
    },
    cosmosDb: {
        // endpoint: import.meta.env.VITE_AZURE_COSMOS_ENDPOINT,
        // key: import.meta.env.VITE_AZURE_COSMOS_KEY,
        connectionString: import.meta.env.VITE_AZURE_COSMOS_CONNECTION_STRING,
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
            analyticsData: 'analytics_data',
        },
    },
    keyVault: {
        vaultUrl: import.meta.env.VITE_AZURE_KEYVAULT_URL,
    },
    openai: {
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        model: 'text-embedding-3-small',
        dimensions: 1536,
    },
};

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
    'VITE_OPENAI_API_KEY',
];

for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Initialize MSAL instance for authentication
export const msalInstance = new PublicClientApplication({
    auth: azureConfig.auth,
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
});

// Initialize Azure Blob Storage client
export const createBlobServiceClient = async (): Promise<BlobServiceClient> => {
    // Using connection string - secure and simple approach for storage
    return BlobServiceClient.fromConnectionString(azureConfig.storage.connectionString!);
};

// Initialize Azure Cosmos DB client
export const createCosmosClient = (): CosmosClient => {
    return new CosmosClient(azureConfig.cosmosDb.connectionString);
};

// Initialize Azure Key Vault client
export const createKeyVaultClient = (): SecretClient => {
    // WARNING: Using client secret in browser is not secure for production
    // Consider using a backend service or Azure Functions for service-to-service auth
    const credential = new ClientSecretCredential(azureConfig.services.tenantId!, azureConfig.services.clientId!, azureConfig.services.clientSecret!);
    return new SecretClient(azureConfig.keyVault.vaultUrl, credential);
};

// Initialize OpenAI client
export const openaiClient = new OpenAI({
    apiKey: azureConfig.openai.apiKey,
    dangerouslyAllowBrowser: true, // Only for development - use server-side in production
});

export { azureConfig };

// Database type helpers for Azure Cosmos DB
export interface CosmosDatabase {
    user_profiles: UserProfile;
    health_documents: HealthDocument;
    health_embeddings: HealthEmbedding;
    import_sessions: ImportSession;
    data_sources: DataSource;
    rag_documents: RAGDocument;
    rag_chunks: RAGChunk;
    rag_import_sessions: RAGImportSession;
}

