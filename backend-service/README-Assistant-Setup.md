# Azure OpenAI Assistant Setup Guide

This guide explains how to set up the new Azure OpenAI Assistant-based chat service for personalized health conversations.

## Overview

The chat service has been refactored to use **Azure OpenAI Assistants API** instead of regular chat completions. This provides:

- **File Search Integration**: Automatic access to user health data through vector stores
- **Persistent Conversations**: Thread-based conversation management
- **Enhanced Context**: Automatic retrieval of relevant health data without manual RAG implementation
- **Better Personalization**: AI Assistant can maintain context and provide more personalized responses

## Required Environment Variables

Add these environment variables to your `.env` file:

```bash
# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai-instance.openai.azure.com/
AZURE_OPENAI_CHAT_MODEL=gpt-4o  # or gpt-4, gpt-35-turbo
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o  # Your model deployment name

# Vector Store for Health Data
AZURE_OPENAI_VECTOR_STORE_ID=vs_hpVCuZvyz7mBRHLnS9IrXsvl  # Your vector store ID

# Optional: Pre-existing Assistant ID (if you want to reuse an assistant)
AZURE_OPENAI_ASSISTANT_ID=asst_your_assistant_id_here
```

## Authentication

The service uses **DefaultAzureCredential** for authentication. Ensure your environment has one of:

1. **Service Principal** (recommended for production):
   ```bash
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   AZURE_TENANT_ID=your-tenant-id
   ```

2. **Azure CLI** (for development):
   ```bash
   az login
   ```

3. **Managed Identity** (when running in Azure)

## Vector Store Setup

Before using the assistant, you need to:

1. **Create a Vector Store** in Azure OpenAI Studio
2. **Upload Health Data Files** to the vector store (JSON, CSV, or text files containing user health data)
3. **Configure File Search** to enable the assistant to search through the health data

### Sample Health Data Format

The assistant works best with structured health data files like:

```json
{
  "user_id": "user123",
  "timestamp": "2024-01-15T10:30:00Z",
  "heart_rate": 72,
  "blood_pressure": "120/80",
  "steps": 8500,
  "sleep_hours": 7.5,
  "notes": "Morning workout completed, feeling energetic"
}
```

## Assistant Configuration

The service automatically creates an assistant with:

- **Name**: `health_aivital_assistant`
- **Instructions**: Health-focused guidance with access to personal data
- **Tools**: File search enabled for health data retrieval
- **Model**: Configurable (gpt-4o recommended)

## API Changes

The refactored service maintains the same API interface for frontend compatibility:

- ✅ `createChatCompletion()` - Now uses assistant threads
- ✅ `createStreamingChatCompletion()` - Simulates streaming (assistants don't support native streaming)
- ✅ `createHealthChatCompletion()` - Enhanced with file search
- ✅ `searchUserHealthData()` - Uses assistant for analysis

## Key Benefits

1. **Automatic Context**: No manual RAG implementation needed
2. **Better Memory**: Threads maintain conversation context
3. **Rich Data Access**: File search provides comprehensive health data access
4. **Personalized Insights**: Assistant learns from conversation patterns
5. **Scalable**: Azure handles the infrastructure

## Migration Notes

- **Frontend**: No changes required - same API interface
- **Environment**: Update environment variables as shown above
- **Data**: Upload health data to Azure OpenAI vector store
- **Authentication**: Switch to Azure credential-based auth

## Troubleshooting

### Common Issues

1. **Assistant not found**: Check `AZURE_OPENAI_ASSISTANT_ID` or let the service create a new one
2. **Vector store access**: Verify `AZURE_OPENAI_VECTOR_STORE_ID` is correct
3. **Authentication**: Ensure Azure credentials are properly configured
4. **Model deployment**: Check that your model deployment name matches configuration

### Debugging

Enable detailed logging by checking the console output for:
- Assistant creation/retrieval
- Thread management
- Run status polling
- Message processing

## Performance Considerations

- **Thread Reuse**: Conversations use persistent threads for better context
- **Polling Timeout**: 60-second timeout for assistant responses
- **Concurrent Requests**: Service handles multiple concurrent conversations
- **Memory Management**: Old threads are cleaned up automatically

## Security

- Uses Azure AD authentication (no API keys in code)
- Conversation threads are isolated per user
- Health data access is controlled by vector store permissions
- All communication over HTTPS with Azure OpenAI 