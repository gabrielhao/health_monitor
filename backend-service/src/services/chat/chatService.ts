import { AzureOpenAI } from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";

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
}

class ChatService {
  private client: AzureOpenAI | null = null;
  private config: ChatServiceConfig | null = null;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  async initialize(): Promise<void> {
    try {
      // Load configuration from environment variables
      this.config = {
        endpoint: process.env.AZURE_OPENAI_CHAT_ENDPOINT || "https://health-monitor-openai.openai.azure.com/",
        apiKey: process.env.AZURE_OPENAI_CHAT_API_KEY || "",
        deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "o4-mini",
        apiVersion: process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-12-01-preview",
        modelName: process.env.AZURE_OPENAI_CHAT_MODEL || "o4-mini"
      };

      if (!this.config.apiKey) {
        throw new Error('Azure OpenAI API key is required for chat service');
      }

      // Initialize Azure OpenAI client
      this.client = new AzureOpenAI({
        endpoint: this.config.endpoint,
        apiKey: this.config.apiKey,
        deployment: this.config.deployment,
        apiVersion: this.config.apiVersion
      });

      console.log(`Chat service configured with endpoint: ${this.config.endpoint}`);
      console.log(`Using deployment: ${this.config.deployment}`);
      
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
        max_completion_tokens: request.maxTokens || 100000,
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
        max_completion_tokens: request.maxTokens || 100000,
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
}

export const chatService = new ChatService(); 