import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chatService } from '../chatService.js';
import type { ApiResponse } from '../../../shared/types/index.js';
import type { ChatRequest, ChatResponse, ChatMessage, HealthChatRequest } from '../chatService.js';
import type { HealthDataSearchOptions } from '../healthRagService.js';

const router = Router();

// Validation schemas
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string()
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  maxTokens: z.number().min(1).max(32768).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional()
});

const conversationIdSchema = z.object({
  conversationId: z.string()
});

const healthSearchOptionsSchema = z.object({
  limit: z.number().min(1).max(50).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  timeRangeStart: z.string().optional(),
  timeRangeEnd: z.string().optional(),
  metricTypes: z.array(z.string()).optional()
});

const healthChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  userId: z.string(),
  conversationId: z.string().optional(),
  maxTokens: z.number().min(1).max(32768).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
  enableHealthContext: z.boolean().optional().default(true),
  healthSearchOptions: healthSearchOptionsSchema.optional()
});

const healthDataSearchSchema = z.object({
  userId: z.string(),
  query: z.string().min(1),
  options: healthSearchOptionsSchema.optional()
});

// Chat completion endpoint
router.post('', async (req: Request, res: Response) => {
  try {
    const validation = chatRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const chatRequest: ChatRequest = {
      ...validation.data,
      messages: validation.data.messages as ChatMessage[]
    };
    
    const chatResponse = await chatService.createChatCompletion(chatRequest);

    res.status(200).json({
      success: true,
      data: chatResponse,
      message: 'Chat completion generated successfully'
    } as ApiResponse<ChatResponse>);

  } catch (error) {
    console.error('Error in chat completion:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Streaming chat completion endpoint
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const validation = chatRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const chatRequest: ChatRequest = {
      ...validation.data,
      messages: validation.data.messages as ChatMessage[]
    };
    
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    try {
      const stream = await chatService.createStreamingChatCompletion(chatRequest);
      
      // Send start event
      res.write(`data: ${JSON.stringify({ type: 'start', conversationId: chatRequest.conversationId })}\n\n`);
      
      // Stream chunks
      for await (const chunk of stream) {
        const data = JSON.stringify({ type: 'chunk', content: chunk });
        res.write(`data: ${data}\n\n`);
      }
      
      // Send end event
      res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
      res.end();
      
    } catch (streamError) {
      console.error('Error in streaming:', streamError);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: streamError instanceof Error ? streamError.message : 'Streaming error' 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Error setting up streaming chat completion:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Get conversation history
router.get('/conversations/:conversationId/history', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      } as ApiResponse);
    }

    const history = chatService.getConversationHistory(conversationId);

    res.json({
      success: true,
      data: {
        conversationId,
        messages: history,
        messageCount: history.length
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Clear conversation history
router.delete('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      } as ApiResponse);
    }

    chatService.clearConversationHistory(conversationId);

    res.json({
      success: true,
      message: `Conversation history cleared for ${conversationId}`
    } as ApiResponse);

  } catch (error) {
    console.error('Error clearing conversation history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Clear all conversations
router.delete('/conversations', async (req: Request, res: Response) => {
  try {
    chatService.clearAllConversations();

    res.json({
      success: true,
      message: 'All conversation histories cleared'
    } as ApiResponse);

  } catch (error) {
    console.error('Error clearing all conversations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Health-aware chat completion with RAG
router.post('/health-chat', async (req: Request, res: Response) => {
  try {
    const validation = healthChatRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const healthChatRequest: HealthChatRequest = {
      ...validation.data,
      messages: validation.data.messages as ChatMessage[]
    };
    
    const chatResponse = await chatService.createHealthChatCompletion(healthChatRequest);

    res.status(200).json({
      success: true,
      data: chatResponse,
      message: 'Health-aware chat completion generated successfully'
    } as ApiResponse<ChatResponse>);

  } catch (error) {
    console.error('Error in health chat completion:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Streaming health-aware chat completion with RAG
router.post('/health-chat/stream', async (req: Request, res: Response) => {
  try {
    const validation = healthChatRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const healthChatRequest: HealthChatRequest = {
      ...validation.data,
      messages: validation.data.messages as ChatMessage[]
    };
    
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    try {
      const stream = await chatService.createStreamingHealthChatCompletion(healthChatRequest);
      
      // Send start event
      res.write(`data: ${JSON.stringify({ type: 'start', conversationId: healthChatRequest.conversationId })}\n\n`);
      
      // Stream chunks
      for await (const chunk of stream) {
        const data = JSON.stringify({ type: 'chunk', content: chunk });
        res.write(`data: ${data}\n\n`);
      }
      
      // Send end event
      res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
      res.end();
      
    } catch (streamError) {
      console.error('Error in health chat streaming:', streamError);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: streamError instanceof Error ? streamError.message : 'Health chat streaming error' 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Error setting up health chat streaming:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Search and analyze user health data
router.post('/health-data/search', async (req: Request, res: Response) => {
  try {
    const validation = healthDataSearchSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      } as ApiResponse);
    }

    const { userId, query, options } = validation.data;
    
    const searchResults = await chatService.searchUserHealthData(userId, query, options);

    res.json({
      success: true,
      data: searchResults,
      message: 'Health data search completed successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error searching health data:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    } as ApiResponse);
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await chatService.healthCheck();
    
    res.json({
      success: true,
      data: {
        service: 'chat-service',
        timestamp: new Date().toISOString(),
        ...healthStatus
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Chat service health check failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Chat service unhealthy'
    } as ApiResponse);
  }
});

export default router; 