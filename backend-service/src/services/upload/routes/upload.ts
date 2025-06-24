import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { azureBlobService } from '../../../shared/services/azureBlobService.js'
import { azureCosmosService } from '../../../shared/services/azureCosmosService.js'
import { chunkedUploadService } from '../chunkedUploadService.js'
import { authMiddleware, type AuthRequest } from '../../../shared/middleware/auth.js'
import type { 
  UploadResult, 
  BatchUploadResult, 
  ApiResponse, 
  BatchApiResponse,
  ChunkedUploadInitResponse,
  ChunkedUploadStatus 
} from '../../../shared/types/index.js'

const router = Router()

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5368709120'), // 5GB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST || '50')
  }
})

// Validation schemas
const uploadRequestSchema = z.object({
  userId: z.string().min(1),
  metadata: z.record(z.string()).optional()
})

const chunkUploadSchema = z.object({
  sessionId: z.string().min(1),
  chunkIndex: z.number().int().min(0)
})

// Single file upload
router.post('', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      })
    }

    const { userId, metadata } = uploadRequestSchema.parse({
      userId: req.body.userId,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    })

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    // Generate file path
    const timestamp = Date.now()
    const fileName = `${userId}/${timestamp}-${req.file.originalname}`

    // Upload to Azure Blob Storage
    const blobResult = await azureBlobService.uploadFile(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      {
        ...metadata,
        userId,
        originalName: req.file.originalname,
        uploadType: 'direct'
      }
    )

    // Save RAG document to Cosmos DB
    console.log('[Upload] Saving RAG document to Cosmos DB')
    let ragDocument
    try {
      ragDocument = await azureCosmosService.createRAGDocument({
        user_id: userId,
        documentId: blobResult.id,
        documentFilePath: blobResult.path,
        isProcessed: false,
        uploadDate: new Date(),
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        contentType: req.file.mimetype,
        metadata: metadata || {}
      })
    } catch (cosmosError) {
      // If Cosmos DB fails, clean up the blob to avoid orphaned files
      console.error('[Upload] Failed to save RAG document, cleaning up blob:', cosmosError)
      try {
        await azureBlobService.deleteFile(fileName)
      } catch (cleanupError) {
        console.error('[Upload] Failed to cleanup blob after Cosmos error:', cleanupError)
      }
      throw new Error(`Failed to save document metadata: ${cosmosError instanceof Error ? cosmosError.message : 'Unknown error'}`)
    }

    // Return comprehensive response with both blob and document information
    const response: ApiResponse = {
      success: true,
      data: {
        // Blob information
        blobPath: blobResult.path,
        blobUrl: blobResult.url,
        blobId: blobResult.id,
        // Document information (what was actually saved)
        documentId: ragDocument.id,
        userId: ragDocument.user_id,
        originalFileName: ragDocument.originalFileName,
        fileSize: ragDocument.fileSize,
        contentType: ragDocument.contentType,
        uploadDate: ragDocument.uploadDate,
        isProcessed: ragDocument.isProcessed,
        metadata: ragDocument.metadata
      }
    }

    res.json(response)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    })
  }
})

// Batch file upload
router.post('/batch', upload.array('files'), async (req: AuthRequest, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      })
    }

    const { userId, metadata } = uploadRequestSchema.parse({
      userId: req.body.userId,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    })

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const files = req.files as Express.Multer.File[]
    const successful: any[] = []
    const failed: Array<{ filename: string; error: string }> = []

    // Upload files individually
    for (const file of files) {
      try {
        const timestamp = Date.now()
        const fileName = `${userId}/${timestamp}-${file.originalname}`

        const blobResult = await azureBlobService.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          {
            ...metadata,
            userId,
            originalName: file.originalname,
            uploadType: 'batch'
          }
        )

        // Save RAG document to Cosmos DB
        let ragDocument
        try {
          ragDocument = await azureCosmosService.createRAGDocument({
            user_id: userId,
            documentId: blobResult.id,
            documentFilePath: blobResult.path,
            isProcessed: false,
            uploadDate: new Date(),
            originalFileName: file.originalname,
            fileSize: file.size,
            contentType: file.mimetype,
            metadata: metadata || {}
          })
        } catch (cosmosError) {
          // If Cosmos DB fails, clean up the blob to avoid orphaned files
          console.error('[Batch Upload] Failed to save RAG document, cleaning up blob:', cosmosError)
          try {
            await azureBlobService.deleteFile(fileName)
          } catch (cleanupError) {
            console.error('[Batch Upload] Failed to cleanup blob after Cosmos error:', cleanupError)
          }
          throw cosmosError
        }

        // Include both blob and document information in response
        successful.push({
          // Blob information
          blobPath: blobResult.path,
          blobUrl: blobResult.url,
          blobId: blobResult.id,
          // Document information (what was actually saved)
          documentId: ragDocument.id,
          userId: ragDocument.userId,
          originalFileName: ragDocument.originalFileName,
          fileSize: ragDocument.fileSize,
          contentType: ragDocument.contentType,
          uploadDate: ragDocument.uploadDate,
          isProcessed: ragDocument.isProcessed,
          metadata: ragDocument.metadata
        })
      } catch (error) {
        failed.push({
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Upload failed'
        })
      }
    }

    const response: BatchApiResponse = {
      success: true,
      data: {
        uploads: successful
      }
    }

    res.json(response)
  } catch (error) {
    console.error('Batch upload error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch upload failed'
    })
  }
})

// Get upload status
router.get('/status/:sessionId', async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params
    const status = await chunkedUploadService.getUploadStatus(sessionId)

    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('Get upload status error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get upload status'
    })
  }
})

// Cancel upload
router.delete('/cancel/:sessionId', async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params
    await chunkedUploadService.cancelUpload(sessionId)

    res.json({
      success: true,
      message: 'Upload cancelled successfully'
    })
  } catch (error) {
    console.error('Cancel upload error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel upload'
    })
  }
})


// Get RAG documents for user
router.get('/rag-documents', async (req: AuthRequest, res) => {
  try {
    const { isProcessed, limit, userId } = req.query
    const documents = await azureCosmosService.getRAGDocuments(userId as string, {
      isProcessed: isProcessed === 'true' ? true : isProcessed === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    })

    res.json({
      success: true,
      data: documents
    })
  } catch (error) {
    console.error('Get RAG documents error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get RAG documents'
    })
  }
})

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'File upload service is healthy',
    timestamp: new Date().toISOString(),
    activeSessions: chunkedUploadService.getActiveSessionsCount()
  })
})

export default router 