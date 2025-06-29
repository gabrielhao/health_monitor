// Health Chat API Configuration
const healthChatApiConfig = {
  baseUrl: import.meta.env.VITE_BACKEND_SERVICE_URL || 'http://localhost:3001/api',
  timeout: 60000, // 60 seconds for health data processing
  maxRetries: 2
};

// ========================================
// TYPES
// ========================================

export interface HealthChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface HealthDataSearchOptions {
  limit?: number;
  similarityThreshold?: number;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  metricTypes?: string[];
}

export interface HealthChatRequest {
  messages: HealthChatMessage[];
  userId: string;
  conversationId?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  enableHealthContext?: boolean;
  healthSearchOptions?: HealthDataSearchOptions;
}

export interface HealthChatResponse {
  id: string;
  message: string;
  conversationId?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  ragContext?: {
    dataSourcesUsed: number;
    averageSimilarity: number;
    contextSummary: string;
  };
}

export interface HealthDataSearchResult {
  query: string;
  relevantData: Array<{
    id: string;
    content: string;
    similarity: number;
    metadata: Record<string, any>;
    timestamp: string;
    chunkIndex: number;
  }>;
  insights: string;
  dataSourcesFound: number;
}

export interface StreamChunk {
  type: 'start' | 'chunk' | 'end' | 'error';
  content?: string;
  conversationId?: string;
  error?: string;
}

// ========================================
// API RESPONSE TYPES
// ========================================

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ========================================
// HEALTH CHAT API CLIENT
// ========================================

class HealthChatApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor() {
    this.baseUrl = healthChatApiConfig.baseUrl;
    this.timeout = healthChatApiConfig.timeout;
    this.maxRetries = healthChatApiConfig.maxRetries;
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
          'X-Client-Name': 'aivital-health-chat',
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
          'X-Client-Name': 'aivital-health-chat',
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

  // Health-aware chat completion with RAG
  async createHealthChatCompletion(request: HealthChatRequest): Promise<HealthChatResponse> {
    const response = await this.makeRequest<ApiResponse<HealthChatResponse>>('/chat/health-chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Invalid response from health chat API');
    }

    return response.data;
  }

  // Streaming health-aware chat completion with RAG
  async* createStreamingHealthChatCompletion(request: HealthChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const stream = await this.makeStreamRequest('/chat/health-chat/stream', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!stream) {
      throw new Error('Failed to create health chat stream');
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
              console.warn('Failed to parse health chat stream chunk:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Search and analyze user health data
  async searchHealthData(
    userId: string,
    query: string,
    options: HealthDataSearchOptions = {}
  ): Promise<HealthDataSearchResult> {
    const response = await this.makeRequest<ApiResponse<HealthDataSearchResult>>('/chat/health-data/search', {
      method: 'POST',
      body: JSON.stringify({ userId, query, options }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Invalid response from health data search API');
    }

    return response.data;
  }
}

// ========================================
// EXPORTED FUNCTIONS
// ========================================

const healthChatApiClient = new HealthChatApiClient();

/**
 * Send a health-aware chat message with RAG context
 */
export async function sendHealthChatMessage(
  messages: HealthChatMessage[],
  options: {
    userId: string;
    conversationId?: string;
    maxTokens?: number;
    temperature?: number;
    enableHealthContext?: boolean;
    healthSearchOptions?: HealthDataSearchOptions;
  }
): Promise<HealthChatResponse> {
  const request: HealthChatRequest = {
    messages,
    userId: options.userId,
    conversationId: options.conversationId,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    enableHealthContext: options.enableHealthContext ?? true,
    healthSearchOptions: options.healthSearchOptions
  };

  return healthChatApiClient.createHealthChatCompletion(request);
}

/**
 * Create a streaming health-aware chat completion
 */
export async function* createStreamingHealthChat(
  messages: HealthChatMessage[],
  options: {
    userId: string;
    conversationId?: string;
    maxTokens?: number;
    temperature?: number;
    enableHealthContext?: boolean;
    healthSearchOptions?: HealthDataSearchOptions;
  }
): AsyncGenerator<StreamChunk, void, unknown> {
  const request: HealthChatRequest = {
    messages,
    userId: options.userId,
    conversationId: options.conversationId,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    enableHealthContext: options.enableHealthContext ?? true,
    healthSearchOptions: options.healthSearchOptions
  };

  yield* healthChatApiClient.createStreamingHealthChatCompletion(request);
}

/**
 * Search user's health data and get AI insights
 */
export async function searchUserHealthData(
  userId: string,
  query: string,
  options: HealthDataSearchOptions = {}
): Promise<HealthDataSearchResult> {
  return healthChatApiClient.searchHealthData(userId, query, options);
}

/**
 * Generate health insights for common questions
 */
export async function generateHealthInsights(
  userId: string,
  insightType: 'sleep' | 'activity' | 'heart_rate' | 'general',
  timeRange?: { start: string; end: string }
): Promise<HealthDataSearchResult> {
  const queries = {
    sleep: "Analyze my sleep patterns and quality. Show trends, average duration, and any issues.",
    activity: "Review my physical activity levels, steps, and exercise patterns. Highlight trends and recommendations.",
    heart_rate: "Examine my heart rate data including resting heart rate trends and variability.",
    general: "Provide a comprehensive overview of my health metrics and overall wellness trends."
  };

  const searchOptions: HealthDataSearchOptions = {
    limit: 15,
    similarityThreshold: 0.7,
    ...(timeRange && {
      timeRangeStart: timeRange.start,
      timeRangeEnd: timeRange.end
    })
  };

  return searchUserHealthData(userId, queries[insightType], searchOptions);
}

export default healthChatApiClient; 