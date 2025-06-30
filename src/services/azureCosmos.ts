import type { HealthDocument, HealthEmbedding, ImportSession } from '@/types/index';
import type { RAGChunk, RAGDocument, RAGImportSession } from '@/types/rag';
import type { Database, Container } from '@azure/cosmos';
import type { CosmosClient } from '@azure/cosmos';

import { azureConfig, createCosmosClient } from './azureConfig';

class AzureCosmosService {
    private client: CosmosClient | null = null;
    private database: Database | null = null;
    private containers: Record<string, Container> = {};
    private initPromise: Promise<void> | null = null;

    async initialize(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInitialize();
        }
        return this.initPromise;
    }

    private async doInitialize(): Promise<void> {
        if (!this.client) {
            this.client = createCosmosClient();
            // Initialize database
            const { database } = await this.client.databases.createIfNotExists({
                id: azureConfig.cosmosDb.databaseId,
            });
            this.database = database;

            // Initialize all containers
            await this.initializeContainers();

            console.log('Azure Cosmos DB connected successfully');
        }
    }

    private async initializeContainers(): Promise<void> {
        if (!this.database) {
            throw new Error('Database not initialized');
        }

        const containerConfigs = [
            { id: azureConfig.cosmosDb.containers.healthDocuments, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.healthEmbeddings, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.importSessions, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.dataSources, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.ragDocuments, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.ragChunks, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.ragImportSessions, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.userProfiles, partitionKey: '/id' },
            { id: azureConfig.cosmosDb.containers.healthMetrics, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.chatMessages, partitionKey: '/user_id' },
            { id: azureConfig.cosmosDb.containers.analyticsData, partitionKey: '/user_id' },
        ];

        for (const config of containerConfigs) {
            const { container } = await this.database.containers.createIfNotExists({
                id: config.id,
                partitionKey: config.partitionKey,
            });
            this.containers[config.id] = container;
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            this.client.dispose();
            this.client = null;
            this.database = null;
            this.containers = {};
        }
    }

    private ensureContainer(containerName: string): Container {
        const container = this.containers[containerName];
        if (!container) {
            throw new Error(`Container ${containerName} not initialized. Call initialize() first.`);
        }
        return container;
    }

    // Health Documents Operations
    async createHealthDocument(document: Omit<HealthDocument, 'id' | 'created_at'>): Promise<HealthDocument> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.healthDocuments);

        const newDocument: HealthDocument = {
            id: `health_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...document,
            created_at: new Date().toISOString(),
            _partitionKey: document.user_id,
        };

        const { resource } = await container.items.create(newDocument);
        return resource as HealthDocument;
    }

    async getHealthDocuments(
        userId: string,
        filters?: {
            source_app?: string;
            document_type?: string;
            limit?: number;
        },
    ): Promise<HealthDocument[]> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.healthDocuments);

        let query = 'SELECT * FROM c WHERE c.user_id = @userId';
        const parameters = [{ name: '@userId', value: userId }];

        if (filters?.source_app) {
            query += ' AND c.source_app = @sourceApp';
            parameters.push({ name: '@sourceApp', value: filters.source_app });
        }

        if (filters?.document_type) {
            query += ' AND c.document_type = @documentType';
            parameters.push({ name: '@documentType', value: filters.document_type });
        }

        query += ' ORDER BY c.created_at DESC';

        if (filters?.limit) {
            query = `SELECT TOP ${filters.limit} * FROM (${query}) as ordered_results`;
        }

        const { resources } = await container.items
            .query(
                {
                    query,
                    parameters,
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        return resources as HealthDocument[];
    }

    async getHealthDocumentById(documentId: string, userId: string): Promise<HealthDocument | null> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.healthDocuments);

        try {
            const { resource } = await container.item(documentId, userId).read<HealthDocument>();
            return resource || null;
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    // Health Embeddings Operations
    async createEmbedding(embedding: Omit<HealthEmbedding, 'id' | 'created_at'>): Promise<HealthEmbedding> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.healthEmbeddings);

        const newEmbedding: HealthEmbedding = {
            id: `embedding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...embedding,
            created_at: new Date().toISOString(),
            _partitionKey: embedding.user_id,
        };

        const { resource } = await container.items.create(newEmbedding);
        return resource as HealthEmbedding;
    }

    async searchSimilarContent(
        queryEmbedding: number[],
        userId: string,
        options?: {
            threshold?: number;
            limit?: number;
        },
    ): Promise<any[]> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.healthEmbeddings);

        // Note: Cosmos DB doesn't have built-in vector similarity search
        // This is a simplified version that returns recent embeddings
        // For production, you'd want to use Azure Cognitive Search or implement
        // a more sophisticated similarity calculation

        const query = `
      SELECT TOP ${options?.limit || 10}
        c.document_id,
        c.content_chunk,
        c.chunk_index,
        c.embedding,
        1.0 as similarity
      FROM c 
      WHERE c.user_id = @userId
      ORDER BY c.created_at DESC
    `;

        const { resources } = await container.items
            .query(
                {
                    query,
                    parameters: [{ name: '@userId', value: userId }],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        // Calculate cosine similarity with queryEmbedding
        return resources
            .map((item: any) => {
                const similarity = this.calculateCosineSimilarity(queryEmbedding, item.embedding);
                return {
                    ...item,
                    similarity,
                };
            })
            .filter((item: any) => item.similarity >= (options?.threshold || 0.8))
            .sort((a: any, b: any) => b.similarity - a.similarity);
    }

    private calculateCosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Import Sessions Operations
    async createImportSession(session: Omit<ImportSession, 'id' | 'started_at'>): Promise<ImportSession> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.importSessions);

        const newSession: ImportSession = {
            id: `import_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...session,
            started_at: new Date().toISOString(),
            _partitionKey: session.user_id,
        };

        const { resource } = await container.items.create(newSession);
        return resource as ImportSession;
    }

    async updateImportSession(sessionId: string, userId: string, updates: Partial<ImportSession>): Promise<ImportSession> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.importSessions);

        // Get current session
        const { resource: currentSession } = await container.item(sessionId, userId).read<ImportSession>();
        if (!currentSession) {
            throw new Error(`Import session ${sessionId} not found`);
        }

        // Apply updates
        const updatedSession = {
            ...currentSession,
            ...updates,
            _partitionKey: userId,
        };

        const { resource } = await container.item(sessionId, userId).replace(updatedSession);
        return resource as ImportSession;
    }

    async getImportSession(sessionId: string, userId: string): Promise<ImportSession | null> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.importSessions);

        try {
            const { resource } = await container.item(sessionId, userId).read<ImportSession>();
            return resource || null;
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    // RAG Documents Operations
    async createRagDocument(document: Omit<RAGDocument, 'id'>): Promise<RAGDocument> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragDocuments);

        const newDocument: RAGDocument = {
            id: `rag_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...document,
            uploadDate: new Date(),
            _partitionKey: document.user_id,
        };

        const { resource } = await container.items.create(newDocument);
        return resource as RAGDocument;
    }

    async updateRagDocument(documentId: string, userId: string, updates: Partial<RAGDocument>): Promise<RAGDocument> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragDocuments);

        const { resource: currentDoc } = await container.item(documentId, userId).read<RAGDocument>();
        if (!currentDoc) {
            throw new Error(`RAG document ${documentId} not found`);
        }

        const updatedDocument = {
            ...currentDoc,
            ...updates,
            updated_at: new Date().toISOString(),
            _partitionKey: userId,
        };

        const { resource } = await container.item(documentId, userId).replace(updatedDocument);
        return resource as RAGDocument;
    }

    // RAG Chunks Operations
    async createRagChunk(chunk: Omit<RAGChunk, 'id' | 'created_at'>): Promise<RAGChunk> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragChunks);

        const newChunk: RAGChunk = {
            id: `rag_chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...chunk,
            created_at: new Date().toISOString()
        };

        const { resource } = await container.items.create(newChunk);
        return resource as RAGChunk;
    }

    // RAG Import Sessions Operations
    async createRagImportSession(session: Omit<RAGImportSession, 'id' | 'started_at'>): Promise<RAGImportSession> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragImportSessions);

        const newSession: RAGImportSession = {
            id: `rag_import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...session,
            started_at: new Date().toISOString()
        };

        const { resource } = await container.items.create(newSession);
        return resource as RAGImportSession;
    }

    async updateRagImportSession(sessionId: string, userId: string, updates: Partial<RAGImportSession>): Promise<RAGImportSession> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragImportSessions);

        const { resource: currentSession } = await container.item(sessionId, userId).read<RAGImportSession>();
        if (!currentSession) {
            throw new Error(`RAG import session ${sessionId} not found`);
        }

        const updatedSession = {
            ...currentSession,
            ...updates,
            _partitionKey: userId,
        };

        const { resource } = await container.item(sessionId, userId).replace(updatedSession);
        return resource as RAGImportSession;
    }

    async getRagDocuments(userId: string, options?: { limit?: number }): Promise<RAGDocument[]> {
        console.log("[Cosmos] getRagDocuments", userId, options);
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragDocuments);

        const query = `
      SELECT * FROM c 
      WHERE c.user_id = @userId 
      ORDER BY c.created_at DESC
      ${options?.limit ? `OFFSET 0 LIMIT ${options.limit}` : ''}
    `;

        const { resources } = await container.items
            .query(
                {
                    query,
                    parameters: [{ name: '@userId', value: userId }],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        return resources as RAGDocument[];
    }

    async getRagImportSessions(userId: string): Promise<RAGImportSession[]> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragImportSessions);

        const query = `
      SELECT * FROM c 
      WHERE c.user_id = @userId 
      ORDER BY c.started_at DESC
    `;

        const { resources } = await container.items
            .query(
                {
                    query,
                    parameters: [{ name: '@userId', value: userId }],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        return resources as RAGImportSession[];
    }

    async searchSimilarRagChunks(_queryEmbedding: number[], userId: string, options?: { threshold?: number; limit?: number }): Promise<RAGChunk[]> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragChunks);

        // Simple implementation - in production, you'd want vector similarity search
        const query = `
      SELECT TOP ${options?.limit || 10} * FROM c 
      WHERE c.user_id = @userId 
      ORDER BY c.created_at DESC
    `;

        const { resources } = await container.items
            .query(
                {
                    query,
                    parameters: [{ name: '@userId', value: userId }],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        return resources as RAGChunk[];
    }

    async deleteRagDocument(documentId: string, userId: string): Promise<void> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragDocuments);
        await container.item(documentId, userId).delete();
    }

    async deleteRagChunksByDocument(documentId: string, userId: string): Promise<void> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.ragChunks);

        const { resources } = await container.items
            .query(
                {
                    query: 'SELECT c.id FROM c WHERE c.document_id = @documentId AND c.user_id = @userId',
                    parameters: [
                        { name: '@documentId', value: documentId },
                        { name: '@userId', value: userId },
                    ],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        for (const chunk of resources) {
            await container.item(chunk.id, userId).delete();
        }
    }

    // User Profile Operations
    async getUserProfile(userId: string): Promise<any | null> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.userProfiles);

        try {
            const { resource } = await container.item(userId, userId).read();
            return resource || null;
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    async createUserProfile(profile: any): Promise<any> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.userProfiles);

        console.log(`Creating user profile in user_profile container for user ID: ${profile.id}`);

        // Validate required fields
        if (!profile.id) {
            throw new Error('User profile ID is required');
        }
        if (!profile.email) {
            throw new Error('User profile email is required');
        }

        const newProfile = {
            ...profile,
            created_at: new Date(),
            updated_at: new Date(),
            _partitionKey: profile.id, // Use user ID as partition key
        };

        console.log('Profile data being inserted into user_profile container:', {
            id: newProfile.id,
            email: newProfile.email,
            full_name: newProfile.full_name,
            container: azureConfig.cosmosDb.containers.userProfiles,
        });

        try {
            const { resource } = await container.items.create(newProfile);
            console.log(`User profile successfully created in user_profile container with ID: ${resource.id}`);
            return resource;
        } catch (error: any) {
            console.error('Error creating user profile in Cosmos DB:', error);
            throw new Error(`Failed to create user profile in user_profile container: ${error.message}`);
        }
    }

    async updateUserProfile(userId: string, updates: any): Promise<any> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.userProfiles);

        const { resource: currentProfile } = await container.item(userId, userId).read();
        if (!currentProfile) {
            throw new Error(`User profile ${userId} not found`);
        }

        const updatedProfile = {
            ...currentProfile,
            ...updates,
            updated_at: new Date(),
            _partitionKey: userId,
        };

        const { resource } = await container.item(userId, userId).replace(updatedProfile);
        return resource;
    }

    // Chat Messages Operations
    async getChatMessages(userId: string, options?: { limit?: number }): Promise<any[]> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.chatMessages);

        const query = `
      SELECT * FROM c 
      WHERE c.user_id = @userId 
      ORDER BY c.created_at ASC
      ${options?.limit ? `OFFSET 0 LIMIT ${options.limit}` : ''}
    `;

        const { resources } = await container.items
            .query(
                {
                    query,
                    parameters: [{ name: '@userId', value: userId }],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        return resources || [];
    }

    async createChatMessage(message: any): Promise<any> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.chatMessages);

        const newMessage = {
            id: `chat_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...message,
            created_at: new Date(),
            _partitionKey: message.user_id,
        };

        const { resource } = await container.items.create(newMessage);
        return resource;
    }

    async deleteChatMessage(messageId: string, userId: string): Promise<void> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.chatMessages);
        await container.item(messageId, userId).delete();
    }

    async clearChatMessages(userId: string): Promise<void> {
        const container = this.ensureContainer(azureConfig.cosmosDb.containers.chatMessages);

        const { resources } = await container.items
            .query(
                {
                    query: 'SELECT c.id FROM c WHERE c.user_id = @userId',
                    parameters: [{ name: '@userId', value: userId }],
                },
                {
                    partitionKey: userId,
                },
            )
            .fetchAll();

        for (const message of resources) {
            await container.item(message.id, userId).delete();
        }
    }

    // Health check
    async healthCheck(): Promise<{ status: string; timestamp: Date }> {
        try {
            if (!this.database) {
                throw new Error('Database not initialized');
            }

            await this.database.read();
            return {
                status: 'healthy',
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date(),
            };
        }
    }
}

export const azureCosmos = new AzureCosmosService();

// Start initialization immediately when module loads
azureCosmos.initialize().catch((error) => {
    console.error('Failed to initialize Azure Cosmos service:', error);
    // Don't throw here, let individual operations handle the error
});
