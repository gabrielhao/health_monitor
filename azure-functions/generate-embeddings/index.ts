import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { azureEmbedding } from '../../src/services/azureEmbedding'
import { verifyJWT } from '../../src/services/azureAuth'

interface GenerateEmbeddingsRequest {
  content: string
  maxTokens?: number
  model?: string
  dimensions?: number
}

interface EmbeddingResponse {
  data: {
    embedding: number[]
    index: number
    tokenCount: number
  }[]
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  // Set CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    }
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    context.res.status = 200
    return
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      context.res.status = 401
      context.res.body = { error: 'No authorization header' }
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const user = await verifyJWT(token)

    if (!user) {
      context.res.status = 401
      context.res.body = { error: 'Authentication failed' }
      return
    }

    // Parse request body
    const { content, maxTokens, model, dimensions }: GenerateEmbeddingsRequest = req.body

    if (!content || typeof content !== 'string') {
      context.res.status = 400
      context.res.body = { error: 'Content is required and must be a string' }
      return
    }

    context.log(`Generating embeddings for user: ${user.id}, content length: ${content.length}`)

    // Generate embeddings using Azure OpenAI/OpenAI API
    const embeddingChunks = await azureEmbedding.generateEmbeddings(content, {
      maxTokens: maxTokens || 300,
      model,
      dimensions
    })

    // Format response to match expected structure
    const response: EmbeddingResponse = {
      data: embeddingChunks.map(chunk => ({
        embedding: chunk.embedding,
        index: chunk.index,
        tokenCount: chunk.tokenCount
      }))
    }

    context.res.status = 200
    context.res.body = response

    context.log(`Successfully generated ${embeddingChunks.length} embeddings`)

  } catch (error) {
    context.log.error('Error generating embeddings:', error)
    
    context.res.status = 500
    context.res.body = {
      error: error instanceof Error ? error.message : 'Failed to generate embeddings'
    }
  }
}

export default httpTrigger 