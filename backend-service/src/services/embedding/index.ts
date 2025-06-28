import { embeddingService } from './fileEmbeddingServices.js'

export async function initializeEmbeddingService(): Promise<void> {
  try {
    await embeddingService.initialize()
    console.log('Embedding service initialized successfully')
  } catch (error) {
    console.error('Failed to initialize embedding service:', error)
    throw error
  }
}

export { embeddingService }
export * from './routes/embedding.js' 