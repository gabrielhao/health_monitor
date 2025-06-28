import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { embeddingService } from '../fileEmbeddingServices.js';
import type { ApiResponse, CreateEmbeddingRequest, EmbeddingProcessingResult } from '../../../shared/types/index.js';

const router = Router();

// Validation schemas
const createEmbeddingSchema = z.object({
  ragDocumentId: z.string(),
  userId: z.string(),
  options: z.object({
    batchSize: z.number().optional(),
    maxChunkSize: z.number().optional(),
    maxTextLength: z.number().optional()
  }).optional()
});

const getEmbeddingsSchema = z.object({
  userId: z.string(),
  documentId: z.string().optional(),
  limit: z.number().optional()
});

const deleteEmbeddingsSchema = z.object({
  userId: z.string(),
  documentId: z.string().optional()
});

// Create embeddings for a RAG document
router.post('', async (req: Request, res: Response) => {
  try {
    const validation = createEmbeddingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const { ragDocumentId, userId, options } = validation.data;
    
    const result = await embeddingService.processDocumentEmbeddings(ragDocumentId, userId, options);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Embeddings processed successfully'
    } as ApiResponse<EmbeddingProcessingResult>);

  } catch (error) {
    console.error('Error processing embeddings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Generate embedding for text (utility endpoint)
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { text, options } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      } as ApiResponse);
    }

    const embedding = await embeddingService.generateEmbedding(text, options);

    res.json({
      success: true,
      data: { embedding, dimensions: embedding.length }
    } as ApiResponse<{ embedding: number[]; dimensions: number }>);

  } catch (error) {
    console.error('Error generating embedding:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Get embedding documents
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const { userId, documentId, limit } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId is required as query parameter'
      } as ApiResponse);
    }

    const limitNum = limit ? parseInt(limit as string) : undefined;
    const documents = await embeddingService.getEmbeddingDocuments(
      userId, 
      documentId as string, 
      limitNum
    );

    res.json({
      success: true,
      data: documents
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching embedding documents:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Get embedding documents count
router.get('/documents/count', async (req: Request, res: Response) => {
  try {
    const { userId, documentId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId is required as query parameter'
      } as ApiResponse);
    }

    const count = await embeddingService.getEmbeddingDocumentsCount(
      userId, 
      documentId as string
    );

    res.json({
      success: true,
      data: { count }
    } as ApiResponse<{ count: number }>);

  } catch (error) {
    console.error('Error fetching embedding documents count:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Delete embedding documents
router.delete('/documents', async (req: Request, res: Response) => {
  try {
    const validation = deleteEmbeddingsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const { userId, documentId } = validation.data;
    
    await embeddingService.deleteEmbeddingDocuments(userId, documentId);

    res.json({
      success: true,
      message: `Embedding documents deleted successfully${documentId ? ` for document ${documentId}` : ''}`
    } as ApiResponse);

  } catch (error) {
    console.error('Error deleting embedding documents:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test embedding generation with a simple text
    const testEmbedding = await embeddingService.generateEmbedding('test health data');
    
    res.json({
      success: true,
      data: {
        service: 'embedding-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        embeddingDimensions: testEmbedding.length
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      data: {
        service: 'embedding-service',
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  }
});

export default router;
