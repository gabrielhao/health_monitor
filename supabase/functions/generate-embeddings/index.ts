import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const chunk_size = 1000
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { content } = await req.json();
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }
    // Split content into chunks
    const chunks = splitIntoChunks(content, chunk_size);

    const session = new Supabase.ai.Session('gte-small');

    // Generate embeddings for each chunk
    const embeddings: { embedding: number[] }[] = [];
    for(let i = 0; i < chunks.length; i++){
      const chunk = chunks[i];
      // Call OpenAI API to generate embedding
      const embedding = await generateEmbedding(session,chunk);
      embeddings.push({
        embedding
      });
    }

    return new Response(JSON.stringify({
      data: embeddings
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
function splitIntoChunks(text, chunkSize) {
  const chunks = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';
  for (const sentence of sentences){
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks.filter((chunk)=>chunk.length > 0);
}
async function generateEmbedding(session, text) {
  // Generate the embedding from the user input
  const embedding = await session.run(text, {
    mean_pool: true,
    normalize: true,
  });

  return embedding;

}
