// Chat API Configuration
const chatApiConfig = {
  baseUrl: import.meta.env.VITE_BACKEND_SERVICE_URL || 'http://localhost:3001/api',
  timeout: 30000, // 30 seconds
  maxRetries: 2
};

// Validate chat API configuration
if (!chatApiConfig.baseUrl) {
  console.warn('Backend service URL not configured. Chat responses will use fallback implementation.');
}

// Types based on backend chat service
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  userId?: string;
  conversationId?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  id: string;
  message: string;
  conversationId?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ConversationHistory {
  conversationId: string;
  messages: ChatMessage[];
  messageCount: number;
}

export interface StreamChunk {
  type: 'start' | 'chunk' | 'end' | 'error';
  content?: string;
  conversationId?: string;
  error?: string;
}

// HTTP client for chat API requests
class ChatApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor() {
    this.baseUrl = chatApiConfig.baseUrl;
    this.timeout = chatApiConfig.timeout;
    this.maxRetries = chatApiConfig.maxRetries;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0',
          'X-Client-Name': 'aivital-web',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  private async makeStreamRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ReadableStream<Uint8Array> | null> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-Client-Version': '1.0.0',
          'X-Client-Name': 'aivital-web',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.body;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  // Multi-turn chat completion
  async createChatCompletion(request: ChatRequest): Promise<ChatResponse> {
    interface ApiResponse<T = any> {
      success: boolean;
      data?: T;
      error?: string;
      message?: string;
    }

    const response = await this.makeRequest<ApiResponse<ChatResponse>>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Invalid response from chat API');
    }

    return response.data;
  }

  // Streaming chat completion
  async* createStreamingChatCompletion(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const stream = await this.makeStreamRequest('/chat/stream', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!stream) {
      throw new Error('Failed to create stream');
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield data as StreamChunk;
              
              if (data.type === 'end' || data.type === 'error') {
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse stream chunk:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Get conversation history
  async getConversationHistory(conversationId: string): Promise<ConversationHistory> {
    interface ApiResponse<T = any> {
      success: boolean;
      data?: T;
      error?: string;
    }

    const response = await this.makeRequest<ApiResponse<ConversationHistory>>(
      `/chat/conversations/${conversationId}/history`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch conversation history');
    }

    return response.data;
  }

  // Clear specific conversation
  async clearConversation(conversationId: string): Promise<void> {
    interface ApiResponse {
      success: boolean;
      error?: string;
      message?: string;
    }

    const response = await this.makeRequest<ApiResponse>(
      `/chat/conversations/${conversationId}`,
      { method: 'DELETE' }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to clear conversation');
    }
  }

  // Clear all conversations
  async clearAllConversations(): Promise<void> {
    interface ApiResponse {
      success: boolean;
      error?: string;
      message?: string;
    }

    const response = await this.makeRequest<ApiResponse>(
      '/chat/conversations',
      { method: 'DELETE' }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to clear all conversations');
    }
  }

  // Legacy method for backward compatibility
  async generateChatResponse(message: string, conversationId?: string): Promise<string> {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: message }],
      conversationId,
      systemPrompt: HEALTH_SYSTEM_PROMPT
    };

    const response = await this.createChatCompletion(request);
    return response.message;
  }
}

// Create chat API client instance
const chatApiClient = new ChatApiClient();

// System prompt for health monitoring context
const HEALTH_SYSTEM_PROMPT = `You are a helpful AI assistant specialized in health monitoring and wellness guidance. 

Your role is to:
- Help users understand their health data and metrics
- Provide general health and wellness information
- Encourage healthy lifestyle choices
- Assist with health tracking and monitoring questions
- Offer evidence-based health guidance

Important guidelines:
- Always encourage users to consult healthcare professionals for medical advice
- Provide general wellness information, not specific medical diagnoses
- Be supportive and encouraging about health goals
- Focus on preventive care and healthy lifestyle habits
- Keep responses concise but informative
- If asked about serious medical conditions, always recommend consulting a healthcare provider

Remember: You are not a replacement for professional medical advice, diagnosis, or treatment.`;

// Enhanced API functions for multi-turn conversations

/**
 * Send a message in a multi-turn conversation
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  options: {
    conversationId?: string;
    userId?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
): Promise<ChatResponse> {
  if (!chatApiConfig.baseUrl) {
    throw new Error('Chat API base URL not configured');
  }

  const request: ChatRequest = {
    messages,
    systemPrompt: options.systemPrompt || HEALTH_SYSTEM_PROMPT,
    ...options
  };

  try {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= chatApiConfig.maxRetries; attempt++) {
      try {
        return await chatApiClient.createChatCompletion(request);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Chat API attempt ${attempt + 1} failed:`, error);
        
        if (attempt === chatApiConfig.maxRetries) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError || new Error('Chat API failed after all retry attempts');
  } catch (error) {
    console.error('Error calling chat API:', error);
    throw error;
  }
}

/**
 * Send a message with streaming response in a multi-turn conversation
 */
export async function* sendStreamingChatMessage(
  messages: ChatMessage[],
  options: {
    conversationId?: string;
    userId?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  if (!chatApiConfig.baseUrl) {
    throw new Error('Chat API base URL not configured');
  }

  const request: ChatRequest = {
    messages,
    systemPrompt: options.systemPrompt || HEALTH_SYSTEM_PROMPT,
    ...options
  };

  try {
    yield* chatApiClient.createStreamingChatCompletion(request);
  } catch (error) {
    console.error('Error calling streaming chat API:', error);
    throw error;
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(conversationId: string): Promise<ConversationHistory> {
  if (!chatApiConfig.baseUrl) {
    throw new Error('Chat API base URL not configured');
  }

  return chatApiClient.getConversationHistory(conversationId);
}

/**
 * Clear a specific conversation
 */
export async function clearConversation(conversationId: string): Promise<void> {
  if (!chatApiConfig.baseUrl) {
    throw new Error('Chat API base URL not configured');
  }

  return chatApiClient.clearConversation(conversationId);
}

/**
 * Clear all conversations
 */
export async function clearAllConversations(): Promise<void> {
  if (!chatApiConfig.baseUrl) {
    throw new Error('Chat API base URL not configured');
  }

  return chatApiClient.clearAllConversations();
}

// Legacy function for backward compatibility
export async function generateAIResponse(userMessage: string, conversationId?: string): Promise<string> {
  if (!chatApiConfig.baseUrl) {
    console.error('[Chat API] Chat API base URL not configured.');
    return '';
  }

  try {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= chatApiConfig.maxRetries; attempt++) {
      try {
        const aiResponse = await chatApiClient.generateChatResponse(userMessage, conversationId);
        
        if (!aiResponse || aiResponse.trim() === '') {
          throw new Error('Empty response from chat API');
        }

        return aiResponse.trim();
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Chat API attempt ${attempt + 1} failed:`, error);
        
        if (attempt === chatApiConfig.maxRetries) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    console.error('Chat API failed after all retry attempts:', lastError);
    return '';

  } catch (error) {
    console.error('Error calling chat API:', error);
    return '';
  }
}

export { chatApiConfig }; 