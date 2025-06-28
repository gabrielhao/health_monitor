# Chat API Service

This document describes the Chat API service that provides Azure OpenAI-powered chat completions with multi-turn conversation support.

## Configuration

Add the following environment variables to your `.env` file:

```env
# Azure OpenAI Configuration (for chat service)
AZURE_OPENAI_CHAT_ENDPOINT=https://health-monitor-openai.openai.azure.com/
AZURE_OPENAI_CHAT_KEY=your_azure_openai_chat_key
AZURE_OPENAI_CHAT_DEPLOYMENT=o4-mini
AZURE_OPENAI_CHAT_API_VERSION=2024-12-01-preview
AZURE_OPENAI_CHAT_MODEL=o4-mini
```

## API Endpoints

### 1. Chat Completion

**POST** `/api/chat/completions`

Creates a chat completion with Azure OpenAI.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "conversationId": "conversation-123",
  "maxTokens": 1000,
  "temperature": 0.7,
  "systemPrompt": "You are a helpful health assistant."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "chatcmpl-xxx",
    "message": "Hello! I'm doing well, thank you for asking...",
    "conversationId": "conversation-123",
    "usage": {
      "promptTokens": 10,
      "completionTokens": 15,
      "totalTokens": 25
    },
    "model": "o4-mini"
  },
  "message": "Chat completion generated successfully"
}
```

### 2. Streaming Chat Completion

**POST** `/api/chat/completions/stream`

Creates a streaming chat completion with real-time response chunks.

**Request Body:** Same as above

**Response:** Server-Sent Events (SSE) stream:
```
data: {"type":"start","conversationId":"conversation-123"}

data: {"type":"chunk","content":"Hello"}

data: {"type":"chunk","content":"! I'm"}

data: {"type":"chunk","content":" doing well"}

data: {"type":"end"}
```

### 3. Get Conversation History

**GET** `/api/chat/conversations/{conversationId}/history`

Retrieves the conversation history for a specific conversation.

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "conversation-123",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      },
      {
        "role": "assistant",
        "content": "Hi there! How can I help you?"
      }
    ],
    "messageCount": 2
  }
}
```

### 4. Clear Conversation History

**DELETE** `/api/chat/conversations/{conversationId}`

Clears the conversation history for a specific conversation.

**Response:**
```json
{
  "success": true,
  "message": "Conversation history cleared for conversation-123"
}
```

### 5. Clear All Conversations

**DELETE** `/api/chat/conversations`

Clears all conversation histories.

**Response:**
```json
{
  "success": true,
  "message": "All conversation histories cleared"
}
```

### 6. Health Check

**GET** `/api/chat/health`

Checks the health of the chat service.

**Response:**
```json
{
  "success": true,
  "data": {
    "service": "chat-service",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "status": "healthy",
    "model": "o4-mini",
    "endpoint": "https://health-monitor-openai.openai.azure.com/"
  }
}
```

## Multi-turn Conversations

The chat service automatically maintains conversation history when you provide a `conversationId`. The service:

- Stores up to 20 messages per conversation to prevent memory issues
- Automatically includes conversation history in subsequent requests
- Supports both regular and streaming completions with history

## Example Usage

### Single Turn
```javascript
const response = await fetch('/api/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'What is diabetes?' }
    ]
  })
});
```

### Multi-turn with History
```javascript
// First message
await fetch('/api/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Tell me about diabetes' }
    ],
    conversationId: 'health-chat-1'
  })
});

// Follow-up message (history automatically included)
await fetch('/api/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'What are the symptoms?' }
    ],
    conversationId: 'health-chat-1'
  })
});
```

### Streaming Response
```javascript
const response = await fetch('/api/chat/completions/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Explain machine learning' }
    ],
    conversationId: 'learning-session-1'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'chunk') {
        console.log(data.content);
      }
    }
  }
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error codes:
- `400`: Invalid request body or missing required parameters
- `500`: Internal server error or Azure OpenAI service issues 