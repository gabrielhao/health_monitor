/*
  # Generate Query Embedding Edge Function

  This function generates embeddings for search queries using OpenAI's API.
  Used for semantic search in RAG applications.
*/

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GenerateEmbeddingRequest {
  query: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const { query }: GenerateEmbeddingRequest = await req.json()

    if (!query || query.trim().length === 0) {
      throw new Error('Query is required')
    }

    console.log(`Generating embedding for query: "${query.substring(0, 100)}..."`)

    // Generate embedding using OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-ada-002'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    console.log(`Generated embedding with ${embedding.length} dimensions`)

    return new Response(
      JSON.stringify({
        success: true,
        embedding,
        dimensions: embedding.length,
        model: 'text-embedding-ada-002'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})