import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob'
import { createBlobServiceClient, azureConfig } from './azureConfig'
import { Buffer } from 'buffer'

interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
}

interface UploadResult {
  path: string
  url: string
  size: number
}

class AzureBlobService {
  private blobServiceClient: BlobServiceClient | null = null
  private containerName: string

  constructor() {
    this.containerName = azureConfig.storage.containerName
  }

  async initialize(): Promise<void> {
    if (!this.blobServiceClient) {
      try {
        this.blobServiceClient = await createBlobServiceClient()
        
        // Ensure container exists
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
        await containerClient.createIfNotExists()
        
        console.log('Azure Blob Storage initialized successfully')
      } catch (error: any) {
        console.error('Failed to initialize Azure Blob Storage:', error)
        
        // Provide more helpful error messages
        if (error.code === 'ENOTFOUND' || error.message.includes('connection')) {
          throw new Error('Azure Storage connection failed. Please check your connection string and network connectivity.')
        } else if (error.message.includes('credential') || error.message.includes('authentication')) {
          throw new Error('Azure Storage authentication failed. Please check your credentials and connection string.')
        } else if (error.message.includes('environment variable')) {
          throw new Error('Azure Storage configuration missing. Please set up your environment variables (VITE_AZURE_STORAGE_CONNECTION_STRING).')
        } else {
          throw new Error(`Azure Storage initialization failed: ${error.message}`)
        }
      }
    }
  }

  private ensureConnection(): BlobServiceClient {
    if (!this.blobServiceClient) {
      throw new Error('Blob service not initialized. Call initialize() first.')
    }
    return this.blobServiceClient
  }

  async uploadFile(
    file: File,
    userId: string,
    path?: string
  ): Promise<UploadResult> {
    const blobService = this.ensureConnection()
    
    // Generate file path if not provided
    const timestamp = new Date().getTime()
    const fileName = path || `${userId}/${timestamp}-${file.name}`
    
    const containerClient = blobService.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(fileName)

    // Upload file
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.type
      },
      metadata: {
        userId,
        originalName: file.name,
        uploadTime: new Date().toISOString()
      }
    }

    await blockBlobClient.uploadData(file, uploadOptions)

    return {
      path: fileName,
      url: blockBlobClient.url,
      size: file.size
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const blobService = this.ensureConnection()
    const containerClient = blobService.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(filePath)

    const downloadResponse = await blockBlobClient.download()
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file')
    }

    // Convert stream to buffer
    const chunks: any[] = []
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk)
    }
    
    return Buffer.concat(chunks.map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  }

  async downloadFileAsText(filePath: string): Promise<string> {
    const buffer = await this.downloadFile(filePath)
    return buffer.toString('utf-8')
  }

  async deleteFile(filePath: string): Promise<void> {
    const blobService = this.ensureConnection()
    const containerClient = blobService.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(filePath)

    await blockBlobClient.deleteIfExists()
  }

  async listFiles(userId: string, prefix?: string): Promise<string[]> {
    const blobService = this.ensureConnection()
    const containerClient = blobService.getContainerClient(this.containerName)

    const listOptions = {
      prefix: prefix || userId
    }

    const blobs: string[] = []
    for await (const blob of containerClient.listBlobsFlat(listOptions)) {
      blobs.push(blob.name)
    }

    return blobs
  }

  async getFileMetadata(filePath: string): Promise<Record<string, any>> {
    const blobService = this.ensureConnection()
    const containerClient = blobService.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(filePath)

    const properties = await blockBlobClient.getProperties()
    
    return {
      size: properties.contentLength,
      contentType: properties.contentType,
      lastModified: properties.lastModified,
      metadata: properties.metadata || {}
    }
  }

  async generateSasUrl(filePath: string, expiryHours: number = 1): Promise<string> {
    const blobService = this.ensureConnection()
    const containerClient = blobService.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(filePath)

    // In a real implementation, you would generate a SAS token
    // For now, return the blob URL
    return blockBlobClient.url
  }

  // Chunked upload for large files
  async uploadLargeFile(
    file: File,
    userId: string,
    path?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const blobService = this.ensureConnection()
    
    const timestamp = new Date().getTime()
    const fileName = path || `${userId}/${timestamp}-${file.name}`
    
    const containerClient = blobService.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(fileName)

    const chunkSize = 4 * 1024 * 1024 // 4MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      const blockId = btoa(String(i).padStart(6, '0'))
      await blockBlobClient.stageBlock(blockId, chunk, chunk.size)
      
      if (onProgress) {
        onProgress(((i + 1) / totalChunks) * 100)
      }
    }

    // Commit all blocks
    const blockList = Array.from({ length: totalChunks }, (_, i) => 
      btoa(String(i).padStart(6, '0'))
    )
    
    await blockBlobClient.commitBlockList(blockList, {
      blobHTTPHeaders: {
        blobContentType: file.type
      },
      metadata: {
        userId,
        originalName: file.name,
        uploadTime: new Date().toISOString()
      }
    })

    return {
      path: fileName,
      url: blockBlobClient.url,
      size: file.size
    }
  }
}

export const azureBlob = new AzureBlobService()

// Auto-initialize on module load
azureBlob.initialize().catch(error => {
  console.error('Failed to initialize Azure Blob service:', error)
}) 