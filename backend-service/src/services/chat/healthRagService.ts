import { AzureOpenAI } from "openai";
import { azureCosmosService } from '../../shared/services/azureCosmosService.js';
import type { EmbeddingDocument } from '../../shared/types/index.js';
import { 
    DefaultAzureCredential, 
    getBearerTokenProvider 
  } from "@azure/identity";

// ========================================
// CONSTANTS
// ========================================

const EMBEDDING_MODEL = "text-embedding-ada-002" as const;
const DEFAULT_VECTOR_SEARCH_LIMIT = 10;
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const MAX_CONTEXT_LENGTH = 8000; // Maximum context length for chat model

// ========================================
// TYPES
// ========================================

export interface HealthDataSearchOptions {
  limit?: number;
  similarityThreshold?: number;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  metricTypes?: string[];
}

export interface HealthDataContext {
  query: string;
  relevantData: HealthDataChunk[];
  contextSummary: string;
  totalMatches: number;
  searchOptions: HealthDataSearchOptions;
}

export interface HealthDataChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
  timestamp: string;
  chunkIndex: number;
}

export interface RagResponse {
  context: HealthDataContext;
  enhancedPrompt: string;
  originalQuery: string;
}

// ========================================
// HEALTH RAG SERVICE
// ========================================

export class HealthRagService {
  private openAIClient: AzureOpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize immediately - do it lazily when needed
  }

  /**
   * Initialize OpenAI client for embedding generation (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_KEY) {
      throw new Error('Azure OpenAI credentials not found for health RAG service. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY environment variables.');
    }

    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-ada-002';

    this.openAIClient = new AzureOpenAI({
        endpoint,
        azureADTokenProvider,
        apiVersion: '2023-05-15',
        deployment: deploymentName,
      });

    this.initialized = true;
    console.log('Health RAG Service: OpenAI client initialized successfully');
  }

  /**
   * Generate embedding for user query using OpenAI text-embedding-ada-002
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    await this.ensureInitialized();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    try {
      const result = await this.openAIClient.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query.trim(),
      });

      const embedding = result.data[0].embedding;
      
      if (embedding.length !== 1536) {
        throw new Error(`Unexpected embedding dimensions: ${embedding.length} (expected 1536)`);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating query embedding:', error);
      throw new Error(`Failed to generate query embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for relevant health data using Cosmos DB vector search
   */
  async searchRelevantHealthData(
    userId: string,
    queryEmbedding: number[],
    options: HealthDataSearchOptions = {}
  ): Promise<HealthDataChunk[]> {
    try {
      const searchOptions = {
        limit: options.limit || DEFAULT_VECTOR_SEARCH_LIMIT,
        similarityThreshold: options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD,
        ...options
      };

      // Use Cosmos DB vector search if available, fallback to client-side calculation
      const embeddingDocs = await this.performVectorSearch(userId, queryEmbedding, searchOptions);

      if (!embeddingDocs || embeddingDocs.length === 0) {
        console.log(`No embedding documents found for user ${userId}`);
        return [];
      }

      // Convert to HealthDataChunk format
      const relevantChunks: HealthDataChunk[] = embeddingDocs
        .map((doc: any) => {
          // If vector search provides similarity score, use it; otherwise calculate
          const similarity = doc.similarity || this.calculateCosineSimilarity(queryEmbedding, doc.embedding);
          
          return {
            id: doc.id,
            content: doc.content_chunk,
            similarity,
            metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata || '{}') : (doc.metadata || {}),
            timestamp: doc.timestamp,
            chunkIndex: doc.chunk_index
          };
        })
        .filter(chunk => chunk.similarity >= searchOptions.similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, searchOptions.limit);

      console.log(`Found ${relevantChunks.length} relevant health data chunks for query (similarity threshold: ${searchOptions.similarityThreshold})`);
      return relevantChunks;

    } catch (error) {
      console.error('Error searching health data:', error);
      throw new Error(`Health data search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform vector search using Cosmos DB native capabilities
   */
  private async performVectorSearch(
    userId: string,
    queryEmbedding: number[],
    options: HealthDataSearchOptions
  ): Promise<EmbeddingDocument[]> {
    try {
      // First try to use Cosmos DB vector search (if configured)
      const vectorSearchResults = await this.tryCosmosVectorSearch(userId, queryEmbedding, options);
      
      if (vectorSearchResults && vectorSearchResults.length > 0) {
        console.log(`Used Cosmos DB vector search, found ${vectorSearchResults.length} results`);
        return vectorSearchResults;
      }

      // Fallback to client-side similarity calculation
      console.log('Falling back to client-side similarity calculation');
      return await this.performClientSideVectorSearch(userId, queryEmbedding, options);
      
    } catch (error) {
      console.warn('Vector search failed, falling back to client-side calculation:', error);
      return await this.performClientSideVectorSearch(userId, queryEmbedding, options);
    }
  }

  /**
   * Try Cosmos DB native vector search
   */
  private async tryCosmosVectorSearch(
    userId: string,
    queryEmbedding: number[],
    options: HealthDataSearchOptions
  ): Promise<EmbeddingDocument[]> {
    // For now, we'll implement this as a future enhancement
    // Cosmos DB vector search requires specific configuration and may not be available
    return [];
  }

  /**
   * Fallback client-side vector search
   */
  private async performClientSideVectorSearch(
    userId: string,
    queryEmbedding: number[],
    options: HealthDataSearchOptions
  ): Promise<EmbeddingDocument[]> {
    // Get all embedding documents for the user
    const embeddingDocs = await azureCosmosService.getEmbeddingDocuments(userId, {
      limit: (options.limit || DEFAULT_VECTOR_SEARCH_LIMIT) * 3 // Get more results to filter by similarity
    });

    if (!embeddingDocs || embeddingDocs.length === 0) {
      return [];
    }

    // Calculate similarity scores and return with scores
    const docsWithSimilarity = embeddingDocs
      .map((doc: EmbeddingDocument) => ({
        ...doc,
        similarity: this.calculateCosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return docsWithSimilarity;
  }

  /**
   * Generate comprehensive health context for chat model
   */
  async generateHealthContext(
    userId: string,
    query: string,
    options: HealthDataSearchOptions = {}
  ): Promise<HealthDataContext> {
    try {
      // Generate embedding for the user query
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Search for relevant health data
      const relevantData = await this.searchRelevantHealthData(userId, queryEmbedding, options);

      // Generate context summary
      const contextSummary = this.generateContextSummary(relevantData, query);

      return {
        query,
        relevantData,
        contextSummary,
        totalMatches: relevantData.length,
        searchOptions: options
      };

    } catch (error) {
      console.error('Error generating health context:', error);
      throw new Error(`Failed to generate health context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create enhanced prompt with health data context for chat model
   */
  async createRagEnhancedPrompt(
    userId: string,
    userQuery: string,
    options: HealthDataSearchOptions = {}
  ): Promise<RagResponse> {
    try {
      const context = await this.generateHealthContext(userId, userQuery, options);

      // Create enhanced system prompt with health context
      const enhancedPrompt = this.buildEnhancedPrompt(userQuery, context);

      return {
        context,
        enhancedPrompt,
        originalQuery: userQuery
      };

    } catch (error) {
      console.error('Error creating RAG enhanced prompt:', error);
      throw new Error(`Failed to create enhanced prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build enhanced prompt with health data context
   */
  private buildEnhancedPrompt(userQuery: string, context: HealthDataContext): string {
    const systemPrompt = `You are a knowledgeable and supportive health assistant. You have access to the user's personal health data and should provide insights, explanations, and guidance based on this information.

IMPORTANT GUIDELINES:
- Always base your responses on the provided health data context when available
- Provide specific, data-driven insights when possible
- Be supportive and encouraging while being factual
- If the data is insufficient to answer a question, acknowledge this limitation
- Focus on trends, patterns, and actionable insights
- Always recommend consulting healthcare professionals for medical decisions
- Maintain a conversational and helpful tone

USER'S HEALTH DATA CONTEXT:
${context.contextSummary}

RELEVANT HEALTH DATA DETAILS:
${context.relevantData.map((chunk, index) => 
  `${index + 1}. [Similarity: ${(chunk.similarity * 100).toFixed(1)}%] ${chunk.content}`
).join('\n')}

Total relevant data points found: ${context.totalMatches}

Now, please respond to the user's question: "${userQuery}"

Remember to:
- Reference specific data points from the context when relevant
- Explain trends or patterns you observe
- Provide actionable insights where appropriate
- Maintain a supportive and professional tone`;

    return systemPrompt;
  }

  /**
   * Generate a concise summary of the health data context
   */
  private generateContextSummary(relevantData: HealthDataChunk[], query: string): string {
    if (relevantData.length === 0) {
      return "No relevant health data found for this query.";
    }

    const dataTypes = new Set<string>();
    const timeRange = {
      earliest: '',
      latest: ''
    };

    relevantData.forEach(chunk => {
      // Extract data types from metadata or content
      if (chunk.metadata.metricType) {
        dataTypes.add(chunk.metadata.metricType);
      }

      // Track time range
      if (chunk.timestamp) {
        if (!timeRange.earliest || chunk.timestamp < timeRange.earliest) {
          timeRange.earliest = chunk.timestamp;
        }
        if (!timeRange.latest || chunk.timestamp > timeRange.latest) {
          timeRange.latest = chunk.timestamp;
        }
      }
    });

    const avgSimilarity = relevantData.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantData.length;

    return `Found ${relevantData.length} relevant health data entries with average similarity of ${(avgSimilarity * 100).toFixed(1)}%. 
Data includes: ${Array.from(dataTypes).join(', ') || 'various health metrics'}. 
Time range: ${timeRange.earliest ? `${timeRange.earliest} to ${timeRange.latest}` : 'various dates'}.
This data is highly relevant to the query: "${query}"`;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Embedding vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Health check for the RAG service
   */
  async healthCheck(): Promise<{ status: string; embeddingModel: string; searchCapabilities: string[] }> {
    try {
      // Test embedding generation
      await this.generateQueryEmbedding("test health query");

      return {
        status: 'healthy',
        embeddingModel: EMBEDDING_MODEL,
        searchCapabilities: ['vector_similarity', 'health_data_retrieval', 'context_generation']
      };
    } catch (error) {
      console.error('Health RAG service health check failed:', error);
      throw new Error('Health RAG service is unhealthy');
    }
  }
}

// Export lazy singleton instance
let healthRagServiceInstance: HealthRagService | null = null;

export const getHealthRagService = (): HealthRagService => {
  if (!healthRagServiceInstance) {
    healthRagServiceInstance = new HealthRagService();
  }
  return healthRagServiceInstance;
};

// Backward compatibility - will initialize lazily when accessed
export const healthRagService = new Proxy({} as HealthRagService, {
  get(target, prop) {
    return getHealthRagService()[prop as keyof HealthRagService];
  }
}); 