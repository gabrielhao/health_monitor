import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { azureEmbedding } from '../../src/services/azureEmbedding'
import { verifyJWT } from '../../src/services/azureAuth'

interface GenerateQueryEmbeddingRequest {
  query: string
  model?: string
  dimensions?: number
}

interface QueryEmbeddingResponse {
  embedding: number[]
  model: string
  dimensions: number
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
    const { query, model, dimensions }: GenerateQueryEmbeddingRequest = req.body

    if (!query || typeof query !== 'string') {
      context.res.status = 400
      context.res.body = { error: 'Query is required and must be a string' }
      return
    }

    if (query.trim().length === 0) {
      context.res.status = 400
      context.res.body = { error: 'Query cannot be empty' }
      return
    }

    context.log(`Generating query embedding for user: ${user.id}, query: "${query.substring(0, 100)}..."`)

    // Generate embedding for the query
    const embedding = await azureEmbedding.generateQueryEmbedding(query)

    const response: QueryEmbeddingResponse = {
      embedding,
      model: model || 'text-embedding-3-small',
      dimensions: dimensions || 1536
    }

    context.res.status = 200
    context.res.body = response

    context.log(`Successfully generated query embedding with ${embedding.length} dimensions`)

  } catch (error) {
    context.log.error('Error generating query embedding:', error)
    
    context.res.status = 500
    context.res.body = {
      error: error instanceof Error ? error.message : 'Failed to generate query embedding'
    }
  }
}

export default httpTrigger 