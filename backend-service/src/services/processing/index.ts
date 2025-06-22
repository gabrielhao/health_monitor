import { fileProcessingService } from './fileProcessingService.js'

export async function initializeProcessingService(): Promise<void> {
  try {
    await fileProcessingService.initialize()
    console.log('Processing service initialized successfully')
  } catch (error) {
    console.error('Failed to initialize processing service:', error)
    throw error
  }
}

export { fileProcessingService }
export * from './routes/processing.js' 