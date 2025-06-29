import { CosmosClient, Database, Container } from '@azure/cosmos'
import type { HealthMetric, RAGDocument, EmbeddingDocument } from '../types/index.js'

// Container configuration interface
interface ContainerConfig {
  name: string
  partitionKey: string
  envVarName?: string
  defaultName: string
}

// Container registry for easy management
const CONTAINER_CONFIGS: Record<string, ContainerConfig> = {
  healthMetrics: {
    name: 'healthMetrics',
    partitionKey: '/_partitionKey',
    envVarName: 'AZURE_COSMOS_CONTAINER_HEALTH_METRICS',
    defaultName: 'health_metrics'
  },
  ragDocuments: {
    name: 'ragDocuments',
    partitionKey: '/user_id', // Should match the actual field name in RAGDocument
    envVarName: 'AZURE_COSMOS_CONTAINER_RAG_DOCUMENTS',
    defaultName: 'rag_documents'
  },
  healthEmbeddings: {
    name: 'healthEmbeddings',
    partitionKey: '/user_id',
    envVarName: 'AZURE_COSMOS_CONTAINER_HEALTH_EMBEDDINGS',
    defaultName: 'health_embeddings'
  }
  // Future containers can be easily added here:
  // userProfiles: {
  //   name: 'userProfiles',
  //   partitionKey: '/userId',
  //   envVarName: 'AZURE_COSMOS_CONTAINER_USER_PROFILES',
  //   defaultName: 'user_profiles'
  // }
}

export class AzureCosmosService {
  private cosmosClient: CosmosClient | null = null
  private database: Database | null = null
  private containers: Map<string, Container> = new Map()
  private endpoint: string | null = null
  private key: string | null = null

  constructor() {
    // Lazy initialization - don't validate environment variables at construction time
  }

  private getCredentials(): { endpoint: string; key: string } {
    if (!this.endpoint || !this.key) {
      this.endpoint = process.env.AZURE_COSMOS_ENDPOINT || ''
      this.key = process.env.AZURE_COSMOS_KEY || ''
      
      if (!this.endpoint || !this.key) {
        throw new Error('Azure Cosmos DB endpoint and key are required. Please set AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_KEY environment variables.')
      }
    }
    return { endpoint: this.endpoint, key: this.key }
  }

  private getContainerName(config: ContainerConfig): string {
    return config.envVarName ? (process.env[config.envVarName] || config.defaultName) : config.defaultName
  }

  private async initializeDatabase(): Promise<Database> {
    if (!this.database) {
      const databaseName = process.env.AZURE_COSMOS_DATABASE || 'health-monitor-db'
      this.database = this.cosmosClient!.database(databaseName)
      
      try {
        await this.database.read()
      } catch (error) {
        console.log(`Creating database: ${databaseName}`)
        await this.cosmosClient!.databases.create({ id: databaseName })
        this.database = this.cosmosClient!.database(databaseName)
      }
    }
    return this.database
  }

  private async initializeContainer(config: ContainerConfig): Promise<Container> {
    const database = await this.initializeDatabase()
    const containerName = this.getContainerName(config)
    
    let container = database.container(containerName)
    
    try {
      await container.read()
    } catch (error) {
      console.log(`Creating container: ${containerName}`)
      await database.containers.create({
        id: containerName,
        partitionKey: config.partitionKey
      })
      container = database.container(containerName)
    }
    
    return container
  }

  async initialize(): Promise<void> {
    if (!this.cosmosClient) {
      const { endpoint, key } = this.getCredentials()
      this.cosmosClient = new CosmosClient({ endpoint, key })

      // Initialize all configured containers
      for (const [key, config] of Object.entries(CONTAINER_CONFIGS)) {
        const container = await this.initializeContainer(config)
        this.containers.set(key, container)
      }

      console.log('Azure Cosmos DB initialized successfully')
    }
  }

  private getContainer(containerKey: string): Container {
    const container = this.containers.get(containerKey)
    if (!container) {
      throw new Error(`Container '${containerKey}' not initialized. Available containers: ${Array.from(this.containers.keys()).join(', ')}`)
    }
    return container
  }

  private ensureConnection(): void {
    if (!this.database || this.containers.size === 0) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.')
    }
  }

  // Health Metrics Operations
  async createHealthMetric(metric: Omit<HealthMetric, 'id'>): Promise<HealthMetric> {
    this.ensureConnection()
    const container = this.getContainer('healthMetrics')
    
    const newMetric: HealthMetric = {
      ...metric,
      id: `${metric.userId}_${metric.metricType}_${metric.timestamp.getTime()}`,
      user_id: metric.userId
    }

    const response = await container.items.create(newMetric)
    return response.resource as HealthMetric
  }

  async createHealthMetricsBatch(metrics: Omit<HealthMetric, 'id'>[]): Promise<HealthMetric[]> {
    console.log('Creating health metrics batch', metrics.length)
    this.ensureConnection()
    const container = this.getContainer('healthMetrics')
    
    const metricsWithIds = metrics.map(metric => ({
      ...metric,
      id: `${metric.userId}_${metric.metricType}_${metric.timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: metric.userId
    }))

    // Create metrics individually for now (bulk operations have type issues)
    const createdMetrics: HealthMetric[] = []
    for (const metric of metricsWithIds) {
      const response = await container.items.create(metric)
      createdMetrics.push(response.resource as HealthMetric)
    }

    console.log(`[CosmosDB] Successfully stored ${createdMetrics.length} health metrics`)

    return createdMetrics
  }

  async getHealthMetrics(
    userId: string,
    options: {
      metricType?: string
      startDate?: Date
      endDate?: Date
      limit?: number
    } = {}
  ): Promise<HealthMetric[]> {
    this.ensureConnection()
    const container = this.getContainer('healthMetrics')
    
    let query = 'SELECT * FROM c WHERE c._partitionKey = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (options.metricType) {
      query += ' AND c.metricType = @metricType'
      parameters.push({ name: '@metricType', value: options.metricType })
    }

    if (options.startDate) {
      query += ' AND c.timestamp >= @startDate'
      parameters.push({ name: '@startDate', value: options.startDate.toISOString() })
    }

    if (options.endDate) {
      query += ' AND c.timestamp <= @endDate'
      parameters.push({ name: '@endDate', value: options.endDate.toISOString() })
    }

    query += ' ORDER BY c.timestamp DESC'

    if (options.limit) {
      query += ` OFFSET 0 LIMIT ${options.limit}`
    }

    const { resources } = await container.items.query<HealthMetric>({
      query,
      parameters
    }).fetchAll()

    return resources
  }

  async deleteHealthMetrics(userId: string, metricType?: string): Promise<void> {
    this.ensureConnection()
    const container = this.getContainer('healthMetrics')
    
    let query = 'SELECT c.id, c._partitionKey FROM c WHERE c._partitionKey = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (metricType) {
      query += ' AND c.metricType = @metricType'
      parameters.push({ name: '@metricType', value: metricType })
    }

    const { resources } = await container.items.query<{ id: string; _partitionKey: string }>({
      query,
      parameters
    }).fetchAll()

    // Delete in batches
    const batchSize = 100
    for (let i = 0; i < resources.length; i += batchSize) {
      const batch = resources.slice(i, i + batchSize)
      for (const item of batch) {
        await container.item(item.id, item._partitionKey).delete()
      }
    }
  }

  // Utility Methods
  async getMetricsCount(userId: string): Promise<number> {
    this.ensureConnection()
    const container = this.getContainer('healthMetrics')
    
    const { resources } = await container.items.query<{ count: number }>({
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c._partitionKey = @userId',
      parameters: [{ name: '@userId', value: userId }]
    }).fetchAll()

    return resources[0]?.count || 0
  }

  // RAG Documents Operations
  async createRAGDocument(document: Omit<RAGDocument, 'id' | '_partitionKey'>): Promise<RAGDocument> {
    this.ensureConnection()
    const container = this.getContainer('ragDocuments')
    
    // Generate a more robust unique ID
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 11) // Use substring instead of deprecated substr
    const documentId = `doc_${document.user_id}_${timestamp}_${randomSuffix}`
    
    const newDocument: RAGDocument = {
      ...document,
      id: documentId,
      _partitionKey: document.user_id
    }
    
    try {
      const response = await container.items.create(newDocument)
      
      // Validate response before returning
      if (!response.resource) {
        throw new Error('Failed to create RAG document: No resource returned')
      }
      
      return response.resource as RAGDocument
    } catch (error) {
      console.error(`[CosmosDB] Error creating RAG document for user ${document.user_id}:`, error)
      throw error
    }
  }

  async getRAGDocument(documentId: string, userId: string): Promise<RAGDocument | null> {
    this.ensureConnection()
    const container = this.getContainer('ragDocuments')
    //console.log('container', container)
    try {
      const response = await container.item(documentId, userId).read()
      //console.log('response', response)
      return response.resource as RAGDocument
    } catch (error) {
      console.error(`[CosmosDB] Error getting RAG document ${documentId}:`, error)
      return null
    }
  }

  async getRAGDocuments(
    userId: string,
    options: {
      isProcessed?: boolean
      limit?: number
    } = {}
  ): Promise<RAGDocument[]> {
    this.ensureConnection()
    const container = this.getContainer('ragDocuments')
    
    let query = 'SELECT * FROM c WHERE c.user_id = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (options.isProcessed !== undefined) {
      query += ' AND c.isProcessed = @isProcessed'
      parameters.push({ name: '@isProcessed', value: options.isProcessed.toString() })
    }

    query += ' ORDER BY c.uploadDate DESC'

    if (options.limit) {
      query += ` OFFSET 0 LIMIT ${options.limit}`
    }

    const { resources } = await container.items.query<RAGDocument>({
      query,
      parameters
    }).fetchAll()

    return resources
  }

  async updateRAGDocument(
    documentId: string,
    updatedDocument: RAGDocument
  ): Promise<RAGDocument> {
    this.ensureConnection()
    const container = this.getContainer('ragDocuments')    
    const response = await container.item(documentId).replace(updatedDocument)
    return response.resource as RAGDocument
  }

  async deleteRAGDocument(documentId: string, userId: string): Promise<void> {
    this.ensureConnection()
    const container = this.getContainer('ragDocuments')
    // Use userId as partition key value since it matches user_id field
    await container.item(documentId, userId).delete()
  }

  async getRAGDocumentsCount(userId: string, isProcessed?: boolean): Promise<number> {
    this.ensureConnection()
    const container = this.getContainer('ragDocuments')
    
    let query = 'SELECT VALUE COUNT(1) FROM c WHERE c.user_id = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (isProcessed !== undefined) {
      query += ' AND c.isProcessed = @isProcessed'
      parameters.push({ name: '@isProcessed', value: isProcessed.toString() })
    }

    const { resources } = await container.items.query<number>({
      query,
      parameters
    }).fetchAll()

    return resources[0] || 0
  }

  // Generic container operations for future extensibility
  getContainerByKey(containerKey: string): Container {
    this.ensureConnection()
    return this.getContainer(containerKey)
  }

  // Add a new container at runtime (for future extensions)
  async addContainer(containerKey: string, config: ContainerConfig): Promise<void> {
    if (this.containers.has(containerKey)) {
      console.warn(`Container '${containerKey}' already exists`)
      return
    }

    CONTAINER_CONFIGS[containerKey] = config
    const container = await this.initializeContainer(config)
    this.containers.set(containerKey, container)
    console.log(`Added new container: ${containerKey}`)
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; containers: string[] }> {
    try {
      this.ensureConnection()
      return {
        status: 'healthy',
        containers: Array.from(this.containers.keys())
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        containers: []
      }
    }
  }

  // Get available container configurations
  getAvailableContainers(): string[] {
    return Array.from(this.containers.keys())
  }

  // Embedding Operations
  async createEmbeddingDocument(document: EmbeddingDocument): Promise<EmbeddingDocument> {
    this.ensureConnection()
    const container = this.getContainer('healthEmbeddings')
    
    const response = await container.items.create(document)
    return response.resource as EmbeddingDocument
  }

  async createEmbeddingDocumentsBatch(documents: EmbeddingDocument[]): Promise<EmbeddingDocument[]> {
    this.ensureConnection()
    const container = this.getContainer('healthEmbeddings')
    
    // Create documents individually for now (bulk operations have type issues)
    const createdDocuments: EmbeddingDocument[] = []
    for (const document of documents) {
      const response = await container.items.create(document)
      createdDocuments.push(response.resource as EmbeddingDocument)
    }

    console.log(`[CosmosDB] Successfully stored ${createdDocuments.length} embedding documents`)
    return createdDocuments
  }

  async getEmbeddingDocuments(
    userId: string,
    options: {
      documentId?: string
      limit?: number
    } = {}
  ): Promise<EmbeddingDocument[]> {
    this.ensureConnection()
    const container = this.getContainer('healthEmbeddings')
    
    let query = 'SELECT * FROM c WHERE c.user_id = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (options.documentId) {
      query += ' AND c.document_id = @documentId'
      parameters.push({ name: '@documentId', value: options.documentId })
    }

    // Note: ORDER BY requires composite index in Cosmos DB
    // For now, we'll skip ordering to avoid index issues
    // query += ' ORDER BY c.document_id, c.chunk_index'

    if (options.limit) {
      query += ` OFFSET 0 LIMIT ${options.limit}`
    }

    const { resources } = await container.items.query<EmbeddingDocument>({
      query,
      parameters
    }, {
      partitionKey: userId
    }).fetchAll()

    return resources
  }

  async deleteEmbeddingDocuments(userId: string, documentId?: string): Promise<void> {
    this.ensureConnection()
    const container = this.getContainer('healthEmbeddings')
    
    let query = 'SELECT c.id FROM c WHERE c.user_id = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (documentId) {
      query += ' AND c.document_id = @documentId'
      parameters.push({ name: '@documentId', value: documentId })
    }

    const { resources } = await container.items.query({
      query,
      parameters
    }, {
      partitionKey: userId
    }).fetchAll()

    for (const resource of resources) {
      await container.item(resource.id, userId).delete()
    }

    console.log(`[CosmosDB] Deleted ${resources.length} embedding documents for user ${userId}${documentId ? ` and document ${documentId}` : ''}`)
  }

  async getEmbeddingDocumentsCount(userId: string, documentId?: string): Promise<number> {
    this.ensureConnection()
    const container = this.getContainer('healthEmbeddings')
    
    let query = 'SELECT VALUE COUNT(1) FROM c WHERE c.user_id = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (documentId) {
      query += ' AND c.document_id = @documentId'
      parameters.push({ name: '@documentId', value: documentId })
    }

    const { resources } = await container.items.query({
      query,
      parameters
    }, {
      partitionKey: userId
    }).fetchAll()

    return resources[0] || 0
  }
}

export const azureCosmosService = new AzureCosmosService() 