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
    const result = await azureBlobService.uploadFile(
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
    await azureCosmosService.createRAGDocument({
      userId,
      documentId: result.id,
      documentFilePath: result.path,
      isProcessed: false,
      uploadDate: new Date(),
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      contentType: req.file.mimetype,
      metadata: metadata || {}
    })

    const response: ApiResponse = {
      success: true,
      data: result
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
    const successful: UploadResult[] = []
    const failed: Array<{ filename: string; error: string }> = []

    // Upload files individually
    for (const file of files) {
      try {
        const timestamp = Date.now()
        const fileName = `${userId}/${timestamp}-${file.originalname}`

        const result = await azureBlobService.uploadFile(
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
        await azureCosmosService.createRAGDocument({
          userId,
          documentId: result.id,
          documentFilePath: result.path,
          isProcessed: false,
          uploadDate: new Date(),
          originalFileName: file.originalname,
          fileSize: file.size,
          contentType: file.mimetype,
          metadata: metadata || {}
        })

        successful.push(result)
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

// Initialize chunked upload
router.post('/chunked/init', async (req: AuthRequest, res) => {
  try {
    const { fileName, contentType, fileSize, chunkSize, metadata, userId } = req.body

    if (!fileName || !contentType || !fileSize || !userId) {
      return res.status(400).json({
        success: false,
        error: 'fileName, contentType, fileSize, and userId are required'
      })
    }
    const result = await chunkedUploadService.initializeChunkedUpload(
      userId,
      fileName,
      contentType,
      parseInt(fileSize),
      chunkSize ? parseInt(chunkSize) : undefined,
      metadata || {}
    )

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Chunked upload init error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize chunked upload'
    })
  }
})

// Upload chunk
router.post('/chunked/chunk', upload.single('chunk'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No chunk data provided'
      })
    }

    const { sessionId, chunkIndex } = chunkUploadSchema.parse({
      sessionId: req.body.sessionId,
      chunkIndex: parseInt(req.body.chunkIndex)
    })

    await chunkedUploadService.uploadChunk(sessionId, chunkIndex, req.file.buffer)

    res.json({
      success: true,
      message: 'Chunk uploaded successfully'
    })
  } catch (error) {
    console.error('Chunk upload error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload chunk'
    })
  }
})

// Finalize chunked upload
router.post('/chunked/finalize', async (req: AuthRequest, res) => {
  try {
    const { sessionId, userId } = req.body

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      })
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const result = await chunkedUploadService.finalizeChunkedUpload(sessionId)

    // Save RAG document to Cosmos DB
    await azureCosmosService.createRAGDocument({
      userId,
      documentId: result.id,
      documentFilePath: result.path,
      isProcessed: false,
      uploadDate: new Date(),
      originalFileName: result.path.split('/').pop() || '',
      fileSize: result.size,
      contentType: 'application/octet-stream', // Default for chunked uploads
      metadata: {}
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Chunked upload finalize error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to finalize upload'
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

// Delete file
router.delete('/files/:fileId', async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params
    await azureBlobService.deleteFile(fileId)

    res.json({
      success: true,
      message: 'File deleted successfully'
    })
  } catch (error) {
    console.error('Delete file error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file'
    })
  }
})

// Get file metadata
router.get('/files/:fileId/metadata', async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params
    const metadata = await azureBlobService.getFileMetadata(fileId)

    res.json({
      success: true,
      data: metadata
    })
  } catch (error) {
    console.error('Get file metadata error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get file metadata'
    })
  }
})

// Get RAG documents for user
router.get('/rag-documents', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { isProcessed, limit } = req.query
    const documents = await azureCosmosService.getRAGDocuments(req.user.id, {
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

// Update RAG document processing status
router.patch('/rag-documents/:documentId/processing-status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { documentId } = req.params
    const { isProcessed } = req.body

    if (typeof isProcessed !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isProcessed must be a boolean'
      })
    }

    const updatedDocument = await azureCosmosService.updateRAGDocument(documentId, req.user.id, {
      isProcessed
    })

    res.json({
      success: true,
      data: updatedDocument
    })
  } catch (error) {
    console.error('Update RAG document error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update RAG document'
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