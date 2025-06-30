import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { healthRagService, type HealthDataSearchOptions, type RagResponse } from './healthRagService.js';

export interface ChatServiceConfig {
  endpoint: string;
  apiKey?: string;
  deployment: string;
  apiVersion: string;
  modelName: string;
  assistantId?: string;
  vectorStoreId?: string;
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

// Assistant-specific interfaces
export interface AssistantThread {
  id: string;
  userId?: string;
  conversationId?: string;
  created_at: number;
}

export interface AssistantRun {
  id: string;
  thread_id: string;
  assistant_id: string;
  status: string;
  created_at: number;
}

class ChatService {
  private client: AzureOpenAI | null = null;
  private config: ChatServiceConfig | null = null;
  private conversationThreads: Map<string, AssistantThread> = new Map();
  private assistantId: string | null = null;

  async initialize(): Promise<void> {
    try {
      const endpoint = process.env.AZURE_OPENAI_CHAT_ENDPOINT || "https://health-monitor-openai.openai.azure.com/";
      const apiVersion = "2024-05-01-preview"; // Required for Assistants API
      const modelName = process.env.AZURE_OPENAI_CHAT_MODEL || "gpt-4.1";
      const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4.1";
      const vectorStoreId = process.env.AZURE_OPENAI_VECTOR_STORE_ID || "vs_hpVCuZvyz7mBRHLnS9IrXsvl";

             // Use DefaultAzureCredential for authentication
       const credential = new DefaultAzureCredential();
       const scope = "https://cognitiveservices.azure.com/.default";
       const azureADTokenProvider = getBearerTokenProvider(credential, scope);

       this.client = new AzureOpenAI({
         endpoint,
         azureADTokenProvider,
         apiVersion
       });

      // Set the config so the service is considered initialized
      this.config = {
        endpoint,
        deployment,
        apiVersion,
        modelName,
        vectorStoreId
      };

      // Create or retrieve the health assistant
      await this.setupHealthAssistant();

      console.log(`Chat service configured with endpoint: ${endpoint}`);
      console.log(`Using model: ${modelName}`);
      console.log(`Assistant ID: ${this.assistantId}`);
      console.log('AI Assistant-based chat service initialization completed successfully');

    } catch (error) {
      console.error('Failed to initialize chat service:', error);
      throw error;
    }
  }

  /**
   * Setup or retrieve the health assistant
   */
  private async setupHealthAssistant(): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('Client not initialized');
    }

    try {
      // Check if assistant already exists (could be stored in env or database)
      const existingAssistantId = process.env.AZURE_OPENAI_ASSISTANT_ID;
      
      if (existingAssistantId) {
        // Verify the assistant exists
        try {
          const assistant = await this.client.beta.assistants.retrieve(existingAssistantId);
          this.assistantId = assistant.id;
          this.config.assistantId = assistant.id;
          console.log(`Using existing assistant: ${this.assistantId}`);
          return;
        } catch (error) {
          console.warn(`Existing assistant ${existingAssistantId} not found, creating new one`);
        }
      }

      // Create new assistant
  const assistantOptions = {
        model: "gpt-4.1", // replace with model deployment name
        name: "health_aivital_assistant",
        input: "user_message",
        instructions: `You are a knowledgeable and supportive health assistant. You have access to the user's personal health data and should provide insights, explanations, and guidance based on this information.
    
    IMPORTANT GUIDELINES:
    - Always base your responses on the provided health data context when available
    - Provide specific, data-driven insights when possible
    - Be supportive and encouraging while being factual
    - If the data is insufficient to answer a question, acknowledge this limitation
    - Focus on trends, patterns, and actionable insights
    - Always recommend consulting healthcare professionals for medical decisions
    - Maintain a conversational and helpful tone
    
    USER'S HEALTH DATA CONTEXT can be obtain from file search.
    
    RELEVANT HEALTH DATA DETAILS can be obtained from file search.
    
    Remember to:
    - Reference specific data points from the context when relevant
    - Explain trends or patterns you observe
    - Provide actionable insights where appropriate
    - Maintain a supportive and professional tone`,
        tools: [{ type: "file_search" as const }],
        tool_resources: { file_search: { vector_store_ids: ["vs_hpVCuZvyz7mBRHLnS9IrXsvl"] }},
        temperature: 1,
        top_p: 1
  };

try {
  const assistantResponse = await this.client.beta.assistants.create(assistantOptions);
  console.log(`Assistant created: ${JSON.stringify(assistantResponse)}`);
  this.assistantId = assistantResponse.id;
  this.config.assistantId = assistantResponse.id;
  console.log(`Created new health assistant: ${this.assistantId}`);
  //console.log(`Assistant configuration: ${JSON.stringify(assistantResponse, null, 2)}`);
} catch (error: any) {
  console.error(`Error creating assistant: ${error.message}`);
  throw new Error(`Failed to create assistant: ${error.message}`);
}

    } catch (error) {
      console.error('Error setting up health assistant:', error);
      throw new Error(`Failed to setup health assistant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create a thread for the conversation
   */
  private async getOrCreateThread(conversationId: string, userId?: string): Promise<AssistantThread> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Check if thread already exists
    let existingThread = this.conversationThreads.get(conversationId);
    if (existingThread) {
      return existingThread;
    }

    try {
      // Create new thread
      const thread = await this.client.beta.threads.create({});
      
      const assistantThread: AssistantThread = {
        id: thread.id,
        userId,
        conversationId,
        created_at: Date.now()
      };

      this.conversationThreads.set(conversationId, assistantThread);
      console.log(`Created new thread: ${thread.id} for conversation: ${conversationId}`);
      
      return assistantThread;
    } catch (error) {
      console.error('Error creating thread:', error);
      throw new Error(`Failed to create thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a message to the thread
   */
  private async addMessageToThread(threadId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      await this.client.beta.threads.messages.create(threadId, {
        role,
        content
      });
    } catch (error) {
      console.error('Error adding message to thread:', error);
      throw new Error(`Failed to add message to thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run the assistant and poll for completion
   */
  private async runAssistantAndPoll(threadId: string): Promise<string> {
    if (!this.client || !this.assistantId) {
      throw new Error('Client or assistant not initialized');
    }

    try {
      // Start the run
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: this.assistantId
      });

      console.log(`Started run: ${run.id} for thread: ${threadId}`);

      // Poll for completion
      let runStatus = run.status;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout

      while ((runStatus === 'queued' || runStatus === 'in_progress') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const runStatusResponse = await this.client.beta.threads.runs.retrieve(threadId, run.id);
        runStatus = runStatusResponse.status;
        attempts++;

        console.log(`Run status: ${runStatus} (attempt ${attempts})`);
      }

      if (runStatus === 'completed') {
        // Get the messages from the thread
        const messagesResponse = await this.client.beta.threads.messages.list(threadId);
        const messages = messagesResponse.data;

        // Find the latest assistant message
        const latestAssistantMessage = messages.find(msg => msg.role === 'assistant');
        
        if (latestAssistantMessage && latestAssistantMessage.content.length > 0) {
          const content = latestAssistantMessage.content[0];
          if (content.type === 'text') {
            return content.text.value;
          }
        }

        throw new Error('No assistant response found');
      } else {
        throw new Error(`Run failed with status: ${runStatus}`);
      }

    } catch (error) {
      console.error('Error running assistant:', error);
      throw new Error(`Assistant run failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create chat completion using the assistant
   */
  async createChatCompletion(request: ChatRequest): Promise<ChatResponse> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      // Use conversationId or generate one if not provided
      const conversationId = request.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get or create thread
      const thread = await this.getOrCreateThread(conversationId, request.userId);

      // Add user messages to thread
      for (const message of request.messages) {
        if (message.role === 'user') {
          await this.addMessageToThread(thread.id, message.role, message.content);
        }
      }

      // Run assistant and get response
      const assistantResponse = await this.runAssistantAndPoll(thread.id);

      return {
        id: `chat_${Date.now()}`,
        message: assistantResponse,
        conversationId,
        model: this.config.modelName
      };

    } catch (error) {
      console.error('Error creating chat completion:', error);
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create streaming chat completion (Note: Assistants API doesn't support streaming directly)
   * This method will simulate streaming by chunking the response
   */
  async createStreamingChatCompletion(request: ChatRequest): Promise<AsyncIterable<string>> {
    const response = await this.createChatCompletion(request);
    return this.simulateStreamingResponse(response.message);
  }

  /**
   * Simulate streaming by chunking the response
   */
  private async* simulateStreamingResponse(message: string): AsyncIterable<string> {
    const words = message.split(' ');
    const chunkSize = 3; // Send 3 words at a time
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      yield chunk + (i + chunkSize < words.length ? ' ' : '');
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  getConversationHistory(conversationId: string): ChatMessage[] {
    // For assistants, conversation history is managed by threads
    // This method could be enhanced to retrieve thread messages if needed
    return [];
  }

  clearConversationHistory(conversationId: string): void {
    this.conversationThreads.delete(conversationId);
  }

  clearAllConversations(): void {
    this.conversationThreads.clear();
  }

  async healthCheck(): Promise<{ status: string; model: string; endpoint: string; assistantId?: string }> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      // Test by checking if the assistant exists
      if (this.assistantId) {
        await this.client.beta.assistants.retrieve(this.assistantId);
      }

      return {
        status: 'healthy',
        model: this.config.modelName,
        endpoint: this.config.endpoint,
        assistantId: this.assistantId || undefined
      };
    } catch (error) {
      console.error('Chat service health check failed:', error);
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create health-aware chat completion with enhanced context
   */
  async createHealthChatCompletion(request: HealthChatRequest): Promise<ChatResponse> {
    if (!this.client || !this.config) {
      throw new Error('Chat service not initialized');
    }

    try {
      let ragContext: ChatResponse['ragContext'] | undefined;

      // If health context is enabled and userId is provided, gather context for metadata
      if (request.enableHealthContext && request.userId && request.messages.length > 0) {
        const userMessage = request.messages[request.messages.length - 1];
        
        if (userMessage.role === 'user') {
          try {
            console.log(`Generating health context metadata for user ${request.userId}`);
            
            const ragResponse = await healthRagService.createRagEnhancedPrompt(
              request.userId,
              userMessage.content,
              request.healthSearchOptions
            );

            // Calculate RAG context stats for response metadata
            if (ragResponse.context.relevantData.length > 0) {
              const avgSimilarity = ragResponse.context.relevantData.reduce(
                (sum, chunk) => sum + chunk.similarity, 0
              ) / ragResponse.context.relevantData.length;

              ragContext = {
                dataSourcesUsed: ragResponse.context.totalMatches,
                averageSimilarity: avgSimilarity,
                contextSummary: ragResponse.context.contextSummary
              };

              console.log(`Health context metadata: ${ragResponse.context.totalMatches} relevant data sources found`);
            }
          } catch (ragError) {
            console.warn('Failed to generate health context metadata:', ragError);
          }
        }
      }

      // Create the chat completion using assistant (the assistant will use file search automatically)
      const response = await this.createChatCompletion(request);

      // Add RAG context metadata to response
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
   * Create streaming health-aware chat completion
   */
  async createStreamingHealthChatCompletion(request: HealthChatRequest): Promise<AsyncIterable<string>> {
    // For health chat with assistants, we use the same flow but with streaming simulation
    const response = await this.createHealthChatCompletion(request);
    return this.simulateStreamingResponse(response.message);
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
      
      // Use the assistant to analyze health data
      const analysisRequest: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: `Please analyze my health data for this query: "${query}". Provide insights about patterns, trends, and recommendations based on the available data.`
          }
        ],
        userId
      };

      const response = await this.createChatCompletion(analysisRequest);

      // Also get RAG context for metadata
      const context = await healthRagService.generateHealthContext(userId, query, options);

      return {
        query,
        relevantData: context.relevantData,
        insights: response.message,
        dataSourcesFound: context.totalMatches
      };

    } catch (error) {
      console.error('Error searching user health data:', error);
      throw new Error(`Health data search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const chatService = new ChatService(); 