import { AzureOpenAI } from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { healthRagService, type HealthDataSearchOptions, type RagResponse } from './healthRagService.js';

export interface ChatServiceConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  modelName: string;
}

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
  ragContext?: {
    dataSourcesUsed: number;
    averageSimilarity: number;
    contextSummary: string;
  };
}

export interface HealthChatRequest extends ChatRequest {
  enableHealthContext?: boolean;
  healthSearchOptions?: HealthDataSearchOptions;
}

class ChatService {
  private client: AzureOpenAI | null = null;
  private config: ChatServiceConfig | null = null;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  async initialize(): Promise<void> {
    try {
      const apiKey = process.env.AZURE_OPENAI_CHAT_API_KEY || "";
      const apiVersion = "2024-04-01-preview";
      const endpoint = process.env.AZURE_OPENAI_CHAT_ENDPOINT || "https://health-monitor-openai.openai.azure.com/";
      const modelName = process.env.AZURE_OPENAI_CHAT_MODEL || "gpt-4.1";
      const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4.1";
      const options = { endpoint, apiKey, deployment, apiVersion }

      this.client = new AzureOpenAI(options);

      // Set the config so the service is considered initialized
      this.config = {
        endpoint,
        apiKey,
        deployment,
        apiVersion,
        modelName
      };

      console.log(`Chat service configured with endpoint: ${endpoint}`);
      console.log(`Using deployment: ${deployment}`);
      console.log('Chat service initialization completed successfully');

      
    } catch (error) {
      console.error('Failed to initialize chat service:', error);
      throw error;
    }
  }

  async createChatCompletion(request: ChatRequest): Promise<ChatResponse> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      // Prepare messages with optional system prompt
      let messages: ChatMessage[] = [];
      
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      
      // Add conversation history if conversationId is provided
      if (request.conversationId) {
        const history = this.conversationHistory.get(request.conversationId) || [];
        messages.push(...history);
      }
      
      // Add current messages
      messages.push(...request.messages);

      // Create chat completion parameters
      const completionParams: ChatCompletionCreateParams = {
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        model: this.config.modelName,
        max_completion_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 1
      };

      // Call Azure OpenAI
      const response = await this.client.chat.completions.create(completionParams);

      // Check for errors
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('No response received from Azure OpenAI');
      }

      const choice = response.choices[0];
      const assistantMessage = choice.message.content || '';

      // Update conversation history if conversationId is provided
      if (request.conversationId) {
        const currentHistory = this.conversationHistory.get(request.conversationId) || [];
        const updatedHistory: ChatMessage[] = [
          ...currentHistory,
          ...request.messages,
          { role: "assistant", content: assistantMessage }
        ];
        
        // Keep only last 20 messages to prevent memory issues
        if (updatedHistory.length > 20) {
          updatedHistory.splice(0, updatedHistory.length - 20);
        }
        
        this.conversationHistory.set(request.conversationId, updatedHistory);
      }

      return {
        id: response.id,
        message: assistantMessage,
        conversationId: request.conversationId,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined,
        model: this.config.modelName
      };

    } catch (error) {
      console.error('Error creating chat completion:', error);
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createStreamingChatCompletion(request: ChatRequest): Promise<AsyncIterable<string>> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      // Prepare messages similar to regular completion
      let messages: ChatMessage[] = [];
      
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      
      if (request.conversationId) {
        const history = this.conversationHistory.get(request.conversationId) || [];
        messages.push(...history);
      }
      
      messages.push(...request.messages);

      const completionParams: ChatCompletionCreateParams = {
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        model: this.config.modelName,
        max_completion_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 1,
        stream: true
      };

      const stream = await this.client.chat.completions.create(completionParams);
      
      return this.createStreamGenerator(stream, request);

    } catch (error) {
      console.error('Error creating streaming chat completion:', error);
      throw new Error(`Streaming chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async* createStreamGenerator(stream: any, request: ChatRequest): AsyncIterable<string> {
    let fullContent = '';
    
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          yield delta;
        }
      }

      // Update conversation history after streaming is complete
      if (request.conversationId && fullContent) {
        const currentHistory = this.conversationHistory.get(request.conversationId) || [];
        const updatedHistory: ChatMessage[] = [
          ...currentHistory,
          ...request.messages,
          { role: "assistant", content: fullContent }
        ];
        
        if (updatedHistory.length > 20) {
          updatedHistory.splice(0, updatedHistory.length - 20);
        }
        
        this.conversationHistory.set(request.conversationId, updatedHistory);
      }
    } catch (error) {
      console.error('Error in stream generator:', error);
      throw error;
    }
  }

  getConversationHistory(conversationId: string): ChatMessage[] {
    return this.conversationHistory.get(conversationId) || [];
  }

  clearConversationHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
  }

  clearAllConversations(): void {
    this.conversationHistory.clear();
  }

  async healthCheck(): Promise<{ status: string; model: string; endpoint: string }> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      // Test with a simple message
      const testResponse = await this.client.chat.completions.create({
        messages: [{ role: "user", content: "Hello" }],
        model: this.config.modelName,
        max_completion_tokens: 10
      });

      if (!testResponse || !testResponse.choices || testResponse.choices.length === 0) {
        throw new Error('Health check failed: No response from Azure OpenAI');
      }

      return {
        status: 'healthy',
        model: this.config.modelName,
        endpoint: this.config.endpoint
      };
    } catch (error) {
      console.error('Chat service health check failed:', error);
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create health-aware chat completion with RAG integration
   */
  async createHealthChatCompletion(request: HealthChatRequest): Promise<ChatResponse> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      let enhancedRequest = { ...request };
      let ragContext: ChatResponse['ragContext'] | undefined;

      // If health context is enabled and userId is provided, enhance with RAG
      if (request.enableHealthContext && request.userId && request.messages.length > 0) {
        const userMessage = request.messages[request.messages.length - 1];
        
        if (userMessage.role === 'user') {
          try {
            console.log(`Generating health context for user ${request.userId}`);
            
            const ragResponse = await healthRagService.createRagEnhancedPrompt(
              request.userId,
              userMessage.content,
              request.healthSearchOptions
            );

            // Add RAG context as system prompt
            enhancedRequest.systemPrompt = ragResponse.enhancedPrompt;

            // Calculate RAG context stats
            if (ragResponse.context.relevantData.length > 0) {
              const avgSimilarity = ragResponse.context.relevantData.reduce(
                (sum, chunk) => sum + chunk.similarity, 0
              ) / ragResponse.context.relevantData.length;

              ragContext = {
                dataSourcesUsed: ragResponse.context.totalMatches,
                averageSimilarity: avgSimilarity,
                contextSummary: ragResponse.context.contextSummary
              };

              console.log(`Health RAG context: ${ragResponse.context.totalMatches} relevant data sources found`);
            }
          } catch (ragError) {
            console.warn('Failed to generate health context, proceeding without RAG:', ragError);
          }
        }
      }

      // Create the chat completion with enhanced context
      const response = await this.createChatCompletion(enhancedRequest);

      // Add RAG context to response
      if (ragContext) {
        response.ragContext = ragContext;
      }

      return response;

    } catch (error) {
      console.error('Error creating health chat completion:', error);
      throw new Error(`Health chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create streaming health-aware chat completion with RAG integration
   */
  async createStreamingHealthChatCompletion(request: HealthChatRequest): Promise<AsyncIterable<string>> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      let enhancedRequest = { ...request };

      // If health context is enabled and userId is provided, enhance with RAG
      if (request.enableHealthContext && request.userId && request.messages.length > 0) {
        const userMessage = request.messages[request.messages.length - 1];
        
        if (userMessage.role === 'user') {
          try {
            console.log(`Generating health context for streaming chat for user ${request.userId}`);
            
            const ragResponse = await healthRagService.createRagEnhancedPrompt(
              request.userId,
              userMessage.content,
              request.healthSearchOptions
            );

            // Add RAG context as system prompt
            enhancedRequest.systemPrompt = ragResponse.enhancedPrompt;

            console.log(`Health RAG context applied for streaming: ${ragResponse.context.totalMatches} relevant data sources`);
          } catch (ragError) {
            console.warn('Failed to generate health context for streaming, proceeding without RAG:', ragError);
          }
        }
      }

      // Create the streaming chat completion with enhanced context
      return await this.createStreamingChatCompletion(enhancedRequest);

    } catch (error) {
      console.error('Error creating streaming health chat completion:', error);
      throw new Error(`Streaming health chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search and analyze user's health data for a specific query
   */
  async searchUserHealthData(
    userId: string,
    query: string,
    options: HealthDataSearchOptions = {}
  ): Promise<{
    query: string;
    relevantData: any[];
    insights: string;
    dataSourcesFound: number;
  }> {
    try {
      console.log(`Searching health data for user ${userId}: "${query}"`);
      
      const context = await healthRagService.generateHealthContext(userId, query, options);

      // Generate insights based on the health data
      const insightsPrompt = `Based on the following health data context, provide a brief analysis and insights:

${context.contextSummary}

Relevant data details:
${context.relevantData.map((chunk, index) => 
  `${index + 1}. ${chunk.content}`
).join('\n')}

Please provide:
1. Key patterns or trends you observe
2. Notable insights about the user's health
3. Any recommendations or areas of focus
4. Overall assessment

Keep the response concise and actionable.`;

      const insightsResponse = await this.createChatCompletion({
        messages: [{ role: 'user', content: insightsPrompt }],
        systemPrompt: 'You are a health data analyst. Provide clear, factual insights based on the provided health data.'
      });

      return {
        query,
        relevantData: context.relevantData,
        insights: insightsResponse.message,
        dataSourcesFound: context.totalMatches
      };

    } catch (error) {
      console.error('Error searching user health data:', error);
      throw new Error(`Health data search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const chatService = new ChatService(); 