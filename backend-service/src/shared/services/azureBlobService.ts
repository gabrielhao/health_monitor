import { BlobServiceClient, BlockBlobClient, ContainerClient, BlobSASPermissions } from '@azure/storage-blob'
import { ClientSecretCredential } from '@azure/identity'
import { Readable } from 'stream'
import type { UploadResult, FileMetadata } from '../types/index.js'

export class AzureBlobService {
  private blobServiceClient: BlobServiceClient | null = null
  private containerClient: ContainerClient | null = null
  private containerName: string
  private connectionString: string | null = null

  constructor() {
    this.containerName = process.env.AZURE_STORAGE_CONTAINER || 'health-files'
  }

  private getConnectionString(): string {
    if (!this.connectionString) {
      this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || ''
      if (!this.connectionString) {
        throw new Error('Azure Storage connection string is required. Please set AZURE_STORAGE_CONNECTION_STRING environment variable.')
      }
    }
    return this.connectionString
  }

  async initialize(): Promise<void> {
    if (!this.blobServiceClient) {
      const connectionString = this.getConnectionString()
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      
      console.log(`Azure Blob Storage initialized for container: ${this.containerName}`)
    }
  }

  private ensureConnection(): { blobService: BlobServiceClient; container: ContainerClient } {
    if (!this.blobServiceClient || !this.containerClient) {
      throw new Error('Blob service not initialized. Call initialize() first.')
    }
    return { blobService: this.blobServiceClient, container: this.containerClient }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<UploadResult> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(fileName)

    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType
      },
      metadata: {
        ...metadata,
        uploadTime: new Date().toISOString()
      }
    }

    await blockBlobClient.uploadData(buffer, uploadOptions)

    return {
      path: fileName,
      url: blockBlobClient.url,
      size: buffer.length,
      id: fileName,
      metadata
    }
  }

  async uploadLargeFile(
    chunks: Buffer[],
    fileName: string,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<UploadResult> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(fileName)

    // Stage all blocks
    const blockIds: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      const blockId = Buffer.from(String(i).padStart(6, '0')).toString('base64')
      await blockBlobClient.stageBlock(blockId, chunks[i], chunks[i].length)
      blockIds.push(blockId)
    }

    // Commit all blocks
    await blockBlobClient.commitBlockList(blockIds, {
      blobHTTPHeaders: {
        blobContentType: contentType
      },
      metadata: {
        ...metadata,
        uploadTime: new Date().toISOString()
      }
    })

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0)

    return {
      path: fileName,
      url: blockBlobClient.url,
      size: totalSize,
      id: fileName,
      metadata
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(filePath)

    const downloadResponse = await blockBlobClient.download()
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file')
    }

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    
    return Buffer.concat(chunks)
  }

  async deleteFile(filePath: string): Promise<void> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(filePath)
    await blockBlobClient.deleteIfExists()
  }

  async listFiles(userId: string, prefix?: string): Promise<string[]> {
    const { container } = this.ensureConnection()

    const listOptions = {
      prefix: prefix || userId
    }

    const blobs: string[] = []
    for await (const blob of container.listBlobsFlat(listOptions)) {
      blobs.push(blob.name)
    }

    return blobs
  }

  async getFileMetadata(filePath: string): Promise<FileMetadata> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(filePath)

    const properties = await blockBlobClient.getProperties()
    
    return {
      id: filePath,
      url: blockBlobClient.url,
      path: filePath,
      size: properties.contentLength || 0,
      type: properties.contentType || 'application/octet-stream',
      uploadedAt: properties.lastModified?.toISOString() || new Date().toISOString(),
      metadata: properties.metadata || {}
    }
  }

  async generateSasUrl(filePath: string, expiryHours: number = 1): Promise<string> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(filePath)

    // Generate SAS token
    const sasToken = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
    })

    return sasToken
  }

  async fileExists(filePath: string): Promise<boolean> {
    const { container } = this.ensureConnection()
    const blockBlobClient = container.getBlockBlobClient(filePath)
    
    try {
      await blockBlobClient.getProperties()
      return true
    } catch (error) {
      return false
    }
  }
}

export const azureBlobService = new AzureBlobService() 