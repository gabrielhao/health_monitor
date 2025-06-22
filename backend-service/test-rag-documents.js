// Simple test script to verify RAG document functionality
import dotenv from 'dotenv'
import { azureCosmosService } from './src/shared/services/azureCosmosService.js'

dotenv.config()

async function testRAGDocuments() {
  try {
    console.log('Initializing Cosmos DB service...')
    await azureCosmosService.initialize()
    console.log('Cosmos DB service initialized successfully')

    // Test creating a RAG document
    const testDocument = {
      userId: 'test-user-123',
      documentId: 'test-doc-456',
      documentFilePath: 'test-user-123/1234567890-test-file.pdf',
      isProcessed: false,
      uploadDate: new Date(),
      originalFileName: 'test-file.pdf',
      fileSize: 1024,
      contentType: 'application/pdf',
      metadata: { test: 'data' }
    }

    console.log('Creating test RAG document...')
    const createdDocument = await azureCosmosService.createRAGDocument(testDocument)
    console.log('RAG document created:', createdDocument)

    // Test getting RAG documents
    console.log('Getting RAG documents for test user...')
    const documents = await azureCosmosService.getRAGDocuments('test-user-123')
    console.log('Found documents:', documents.length)

    // Test updating processing status
    console.log('Updating processing status...')
    const updatedDocument = await azureCosmosService.updateRAGDocument(
      createdDocument.id,
      'test-user-123',
      { isProcessed: true }
    )
    console.log('Document updated:', updatedDocument)

    // Test getting count
    const count = await azureCosmosService.getRAGDocumentsCount('test-user-123')
    console.log('Total documents count:', count)

    console.log('All tests passed!')
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testRAGDocuments() 