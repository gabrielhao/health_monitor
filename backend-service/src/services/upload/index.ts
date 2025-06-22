import { chunkedUploadService } from './chunkedUploadService.js'

export function initializeUploadService(): void {
  try {
    console.log('Upload service initialized successfully')
  } catch (error) {
    console.error('Failed to initialize upload service:', error)
    throw error
  }
}

export { chunkedUploadService }
export * from './routes/upload.js' 