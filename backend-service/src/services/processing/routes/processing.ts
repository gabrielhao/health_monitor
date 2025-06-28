import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { fileProcessingService } from '../fileProcessingService.js'
import { authMiddleware } from '../../../shared/middleware/auth.js'
import type { ApiResponse, HealthMetric } from '../../../shared/types/index.js'

const router = Router()

// Validation schemas
const processFileSchema = z.object({
  userId: z.string(),
  ragDocumentId: z.string(),
  options: z.object({
    batchSize: z.number().optional(),
    timeout: z.number().optional(),
    retryAttempts: z.number().optional(),
    transformOptions: z.record(z.any()).optional()
  }).optional()
})

const getMetricsSchema = z.object({
  metricType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().optional()
})

// trigger processing of a rag document with given rag document id
router.post('', async (req: Request, res: Response) => {
  try {
    const validation = processFileSchema.safeParse(req.body)
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse)
    }

    const { userId, ragDocumentId, options } = validation.data
    const is_success = await fileProcessingService.processFile(ragDocumentId, userId, options)

    res.status(202).json({
      success: true,
      data: is_success,
      message: 'File processing job created successfully'
    } as ApiResponse<boolean>)

  } catch (error) {
    console.error('Error creating processing job:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse)
  }
})


// Get metrics count
router.get('/metrics/count', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId is required as query parameter'
      } as ApiResponse)
    }

    const count = await fileProcessingService.getMetricsCount(userId)

    res.json({
      success: true,
      data: { count }
    } as ApiResponse<{ count: number }>)

  } catch (error) {
    console.error('Error fetching metrics count:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse)
  }
})

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const metricsCount = await fileProcessingService.getMetricsCount('test')
    
    res.json({
      success: true,
      data: {
        service: 'file-processing',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metricsCount
      }
    } as ApiResponse)

  } catch (error) {
    console.error('Health check failed:', error)
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      data: {
        service: 'file-processing',
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    } as ApiResponse)
  }
})

export default router 