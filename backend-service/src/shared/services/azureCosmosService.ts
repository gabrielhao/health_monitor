import { CosmosClient, Database, Container } from '@azure/cosmos'
import type { HealthMetric, ProcessingJob, RAGDocument } from '../types/index.js'

export class AzureCosmosService {
  private cosmosClient: CosmosClient | null = null
  private database: Database | null = null
  private healthMetricsContainer: Container | null = null
  private processingJobsContainer: Container | null = null
  private ragDocumentsContainer: Container | null = null
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

  async initialize(): Promise<void> {
    if (!this.cosmosClient) {
      const { endpoint, key } = this.getCredentials()
      this.cosmosClient = new CosmosClient({ endpoint, key })

      const databaseName = process.env.AZURE_COSMOS_DATABASE || 'health-monitor'
      const healthMetricsContainerName = process.env.AZURE_COSMOS_CONTAINER_HEALTH_METRICS || 'health_metrics'
      const ragDocumentsContainerName = process.env.AZURE_COSMOS_CONTAINER_RAG_DOCUMENTS || 'rag_documents'

      // Get or create database
      this.database = this.cosmosClient.database(databaseName)
      try {
        await this.database.read()
      } catch (error) {
        console.log(`Creating database: ${databaseName}`)
        await this.cosmosClient.databases.create({ id: databaseName })
        this.database = this.cosmosClient.database(databaseName)
      }

      // Get or create health metrics container
      this.healthMetricsContainer = this.database.container(healthMetricsContainerName)
      try {
        await this.healthMetricsContainer.read()
      } catch (error) {
        console.log(`Creating container: ${healthMetricsContainerName}`)
        await this.database.containers.create({
          id: healthMetricsContainerName,
          partitionKey: '/_partitionKey'
        })
        this.healthMetricsContainer = this.database.container(healthMetricsContainerName)
      }

      // Get or create rag documents container
      this.ragDocumentsContainer = this.database.container(ragDocumentsContainerName)
      try {
        await this.ragDocumentsContainer.read()
      } catch (error) {
        console.log(`Creating container: ${ragDocumentsContainerName}`)
        await this.database.containers.create({
          id: ragDocumentsContainerName,
          partitionKey: '/userId'
        })
        this.ragDocumentsContainer = this.database.container(ragDocumentsContainerName)
      }

      console.log('Azure Cosmos DB initialized successfully')
    }
  }

  private ensureConnection(): {
    database: Database
    healthMetricsContainer: Container
    processingJobsContainer: Container
    ragDocumentsContainer: Container
  } {
    if (!this.database || !this.healthMetricsContainer || !this.processingJobsContainer || !this.ragDocumentsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.')
    }
    return {
      database: this.database,
      healthMetricsContainer: this.healthMetricsContainer,
      processingJobsContainer: this.processingJobsContainer,
      ragDocumentsContainer: this.ragDocumentsContainer
    }
  }

  // Health Metrics Operations
  async createHealthMetric(metric: Omit<HealthMetric, 'id'>): Promise<HealthMetric> {
    const { healthMetricsContainer } = this.ensureConnection()
    
    const newMetric: HealthMetric = {
      ...metric,
      id: `${metric.userId}_${metric.metricType}_${metric.timestamp.getTime()}`
    }

    const response = await healthMetricsContainer.items.create(newMetric)
    return response.resource as HealthMetric
  }

  async createHealthMetricsBatch(metrics: Omit<HealthMetric, 'id'>[]): Promise<HealthMetric[]> {
    const { healthMetricsContainer } = this.ensureConnection()
    
    const metricsWithIds = metrics.map(metric => ({
      ...metric,
      id: `${metric.userId}_${metric.metricType}_${metric.timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`
    }))

    // Create metrics individually for now (bulk operations have type issues)
    const createdMetrics: HealthMetric[] = []
    for (const metric of metricsWithIds) {
      const response = await healthMetricsContainer.items.create(metric)
      createdMetrics.push(response.resource as HealthMetric)
    }

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
    const { healthMetricsContainer } = this.ensureConnection()
    
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

    const { resources } = await healthMetricsContainer.items.query<HealthMetric>({
      query,
      parameters
    }).fetchAll()

    return resources
  }

  async deleteHealthMetrics(userId: string, metricType?: string): Promise<void> {
    const { healthMetricsContainer } = this.ensureConnection()
    
    let query = 'SELECT c.id, c._partitionKey FROM c WHERE c._partitionKey = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (metricType) {
      query += ' AND c.metricType = @metricType'
      parameters.push({ name: '@metricType', value: metricType })
    }

    const { resources } = await healthMetricsContainer.items.query<{ id: string; _partitionKey: string }>({
      query,
      parameters
    }).fetchAll()

    // Delete in batches
    const batchSize = 100
    for (let i = 0; i < resources.length; i += batchSize) {
      const batch = resources.slice(i, i + batchSize)
      for (const item of batch) {
        await healthMetricsContainer.item(item.id, item._partitionKey).delete()
      }
    }
  }

  // Utility Methods
  async getMetricsCount(userId: string): Promise<number> {
    const { healthMetricsContainer } = this.ensureConnection()
    
    const { resources } = await healthMetricsContainer.items.query<{ count: number }>({
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c._partitionKey = @userId',
      parameters: [{ name: '@userId', value: userId }]
    }).fetchAll()

    return resources[0]?.count || 0
  }

  // RAG Documents Operations
  async createRAGDocument(document: Omit<RAGDocument, 'id' | '_partitionKey'>): Promise<RAGDocument> {
    const { ragDocumentsContainer } = this.ensureConnection()
    
    const newDocument: RAGDocument = {
      ...document,
      id: `doc_${document.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _partitionKey: document.userId
    }

    const response = await ragDocumentsContainer.items.create(newDocument)
    return response.resource as RAGDocument
  }

  async getRAGDocument(documentId: string, userId: string): Promise<RAGDocument | null> {
    const { ragDocumentsContainer } = this.ensureConnection()
    
    try {
      const response = await ragDocumentsContainer.item(documentId, userId).read()
      return response.resource as RAGDocument
    } catch (error) {
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
    const { ragDocumentsContainer } = this.ensureConnection()
    
    let query = 'SELECT * FROM c WHERE c.userId = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (options.isProcessed !== undefined) {
      query += ' AND c.isProcessed = @isProcessed'
      parameters.push({ name: '@isProcessed', value: options.isProcessed.toString() })
    }

    query += ' ORDER BY c.uploadDate DESC'

    if (options.limit) {
      query += ` OFFSET 0 LIMIT ${options.limit}`
    }

    const { resources } = await ragDocumentsContainer.items.query<RAGDocument>({
      query,
      parameters
    }).fetchAll()

    return resources
  }

  async updateRAGDocument(
    documentId: string,
    userId: string,
    updates: Partial<Omit<RAGDocument, 'id' | 'userId' | '_partitionKey'>>
  ): Promise<RAGDocument> {
    const { ragDocumentsContainer } = this.ensureConnection()
    
    const response = await ragDocumentsContainer.item(documentId, userId).replace({
      ...updates
    })

    return response.resource as unknown as RAGDocument
  }

  async deleteRAGDocument(documentId: string, userId: string): Promise<void> {
    const { ragDocumentsContainer } = this.ensureConnection()
    await ragDocumentsContainer.item(documentId, userId).delete()
  }

  async getRAGDocumentsCount(userId: string, isProcessed?: boolean): Promise<number> {
    const { ragDocumentsContainer } = this.ensureConnection()
    
    let query = 'SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId'
    const parameters = [{ name: '@userId', value: userId }]

    if (isProcessed !== undefined) {
      query += ' AND c.isProcessed = @isProcessed'
      parameters.push({ name: '@isProcessed', value: isProcessed.toString() })
    }

    const { resources } = await ragDocumentsContainer.items.query<{ count: number }>({
      query,
      parameters
    }).fetchAll()

    return resources[0]?.count || 0
  }
}

export const azureCosmosService = new AzureCosmosService() 