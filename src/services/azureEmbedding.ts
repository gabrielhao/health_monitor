import { openaiClient, azureConfig } from './azureConfig'

interface EmbeddingChunk {
  content: string
  embedding: number[]
  index: number
  tokenCount: number
}

interface EmbeddingOptions {
  maxTokens?: number
  model?: string
  dimensions?: number
}

class AzureEmbeddingService {
  private readonly defaultMaxTokens = 300
  private readonly defaultModel = azureConfig.openai.model
  private readonly defaultDimensions = azureConfig.openai.dimensions

  async generateEmbeddings(
    content: string,
    options?: EmbeddingOptions
  ): Promise<EmbeddingChunk[]> {
    try {
      // Split content into chunks
      const chunks = this.splitIntoChunks(
        content, 
        options?.maxTokens || this.defaultMaxTokens
      )

      // Generate embeddings for each chunk
      const embeddingChunks: EmbeddingChunk[] = []
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        if (chunk.trim().length === 0) {
          continue
        }

        const embedding = await this.generateSingleEmbedding(
          chunk,
          options?.model || this.defaultModel,
          options?.dimensions || this.defaultDimensions
        )

        embeddingChunks.push({
          content: chunk,
          embedding,
          index: i,
          tokenCount: this.estimateTokenCount(chunk)
        })
      }

      return embeddingChunks
    } catch (error) {
      console.error('Error generating embeddings:', error)
      throw new Error('Failed to generate embeddings')
    }
  }

  async generateSingleEmbedding(
    text: string,
    model?: string,
    dimensions?: number
  ): Promise<number[]> {
    try {
      const response = await openaiClient.embeddings.create({
        model: model || this.defaultModel,
        input: text,
        dimensions: dimensions || this.defaultDimensions
      })

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned')
      }

      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating single embedding:', error)
      throw new Error('Failed to generate embedding')
    }
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateSingleEmbedding(query)
  }

  private splitIntoChunks(text: string, maxTokens: number): string[] {
    const chunks: string[] = []
    
    // Split by sentences first
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      
      if (trimmedSentence.length === 0) {
        continue
      }

      // Estimate tokens for current chunk + new sentence
      const potentialChunk = currentChunk 
        ? `${currentChunk}. ${trimmedSentence}`
        : trimmedSentence

      const estimatedTokens = this.estimateTokenCount(potentialChunk)

      if (estimatedTokens > maxTokens && currentChunk.length > 0) {
        // Add current chunk and start new one
        chunks.push(currentChunk.trim())
        currentChunk = trimmedSentence
      } else {
        // Add sentence to current chunk
        currentChunk = potentialChunk
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }

    return chunks.filter(chunk => chunk.length > 0)
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is a simplified estimation; in production, use a proper tokenizer
    return Math.ceil(text.length / 4)
  }

  // Convert embedding array to Buffer for SQL Server storage
  embeddingToBuffer(embedding: number[]): Buffer {
    const float32Array = new Float32Array(embedding)
    return Buffer.from(float32Array.buffer)
  }

  // Convert Buffer back to embedding array
  bufferToEmbedding(buffer: Buffer): number[] {
    const float32Array = new Float32Array(buffer.buffer)
    return Array.from(float32Array)
  }

  // Calculate cosine similarity between two embeddings
  calculateCosineSimilarity(embeddingA: number[], embeddingB: number[]): number {
    if (embeddingA.length !== embeddingB.length) {
      throw new Error('Embeddings must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i]
      normA += embeddingA[i] * embeddingA[i]
      normB += embeddingB[i] * embeddingB[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }

  // Batch processing for multiple texts
  async generateBatchEmbeddings(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    const embeddings: number[][] = []

    // Process in batches to avoid rate limits
    const batchSize = 10
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateSingleEmbedding(
          text,
          options?.model,
          options?.dimensions
        ))
      )
      
      embeddings.push(...batchEmbeddings)
    }

    return embeddings
  }
}

export const azureEmbedding = new AzureEmbeddingService() 