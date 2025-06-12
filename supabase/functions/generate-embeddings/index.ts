import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  document_id: string
  content: string
  chunk_size?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { document_id, content, chunk_size = 1000 }: RequestBody = await req.json()

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Split content into chunks
    const chunks = splitIntoChunks(content, chunk_size)
    
    // Generate embeddings for each chunk
    const embeddings = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      // Call OpenAI API to generate embedding
      const embedding = await generateEmbedding(chunk)
      
      embeddings.push({
        user_id: user.id,
        document_id,
        content_chunk: chunk,
        embedding,
        chunk_index: i,
        metadata: {
          chunk_length: chunk.length,
          total_chunks: chunks.length
        }
      })
    }

    // Insert embeddings into database
    const { data, error } = await supabaseClient
      .from('health_embeddings')
      .insert(embeddings)
      .select()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        embeddings_created: embeddings.length,
        data 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks = []
  const sentences = text.split(/[.!?]+/)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}

async function generateEmbedding(text: string): Promise<number[]> {
  // In a real implementation, you would call OpenAI's API
  // For demo purposes, return a mock embedding
  const mockEmbedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1)
  
  // Normalize the vector
  const magnitude = Math.sqrt(mockEmbedding.reduce((sum, val) => sum + val * val, 0))
  return mockEmbedding.map(val => val / magnitude)
  
  /* Real OpenAI implementation would look like:
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002'
    })
  })
  
  const data = await response.json()
  return data.data[0].embedding
  */
}