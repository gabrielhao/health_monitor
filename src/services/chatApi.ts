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

  async generateChatResponse(message: string): Promise<string> {
    interface ChatRequest {
      message: string;
      context?: string;
    }

    interface ChatResponse {
      success: boolean;
      data?: {
        response: string;
      };
      error?: string;
    }

    const requestBody: ChatRequest = {
      message,
      context: 'health_monitoring'
    };

    const response = await this.makeRequest<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.success || !response.data?.response) {
      throw new Error(response.error || 'Invalid response from chat API');
    }

    return response.data.response;
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

// Generate AI response using chat API
export async function generateAIResponse(userMessage: string): Promise<string> {
  // If backend service is not configured, use fallback implementation
  if (!chatApiConfig.baseUrl) {
    console.error('[Chat API] Chat API base URL not configured.');
    return '';
  }

  try {
    // Attempt to get response from chat API with retry logic
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= chatApiConfig.maxRetries; attempt++) {
      try {
        const aiResponse = await chatApiClient.generateChatResponse(userMessage);
        
        if (!aiResponse || aiResponse.trim() === '') {
          throw new Error('Empty response from chat API');
        }

        return aiResponse.trim();
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Chat API attempt ${attempt + 1} failed:`, error);
        
        // Don't retry on the last attempt
        if (attempt === chatApiConfig.maxRetries) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // If all attempts failed, log error and use fallback
    console.error('Chat API failed after all retry attempts:', lastError);
    return '';

  } catch (error) {
    console.error('Error calling chat API:', error);
    return '';
  }
}


export { chatApiConfig }; 