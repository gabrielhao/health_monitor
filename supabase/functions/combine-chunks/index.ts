/*
  # Combine Chunks Edge Function

  This function combines uploaded file chunks into a single file and verifies integrity.

  1. Chunk Combination
    - Downloads all chunks for a session
    - Combines them in correct order
    - Verifies SHA-256 checksum

  2. File Processing
    - Calls process-health-file function for actual data processing
    - Handles cleanup of temporary chunks
    - Returns final processing results
*/

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CombineChunksRequest {
  sessionId: string
  fileName: string
  totalChunks: number
  expectedChecksum: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    const { sessionId, fileName, totalChunks, expectedChecksum }: CombineChunksRequest = await req.json()

    console.log(`Combining ${totalChunks} chunks for session ${sessionId}`)

    // Download all chunks
    const chunks: Uint8Array[] = []
    let totalSize = 0

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = `${fileName}.chunk.${i}`
      
      const { data: chunkData, error: downloadError } = await supabase.storage
        .from('health-files')
        .download(chunkPath)

      if (downloadError) {
        throw new Error(`Failed to download chunk ${i}: ${downloadError.message}`)
      }

      const chunkBytes = new Uint8Array(await chunkData.arrayBuffer())
      chunks.push(chunkBytes)
      totalSize += chunkBytes.length
    }

    // Combine chunks
    const combinedFile = new Uint8Array(totalSize)
    let offset = 0

    for (const chunk of chunks) {
      combinedFile.set(chunk, offset)
      offset += chunk.length
    }

    // Verify checksum
    const actualChecksum = await calculateSHA256(combinedFile)
    if (actualChecksum !== expectedChecksum) {
      throw new Error(`Checksum mismatch. Expected: ${expectedChecksum}, Actual: ${actualChecksum}`)
    }

    console.log('Checksum verified successfully')

    // Upload combined file
    const finalPath = fileName.replace(/\.chunk\.\d+$/, '')
    const { error: uploadError } = await supabase.storage
      .from('health-files')
      .upload(finalPath, combinedFile, {
        metadata: {
          originalChecksum: expectedChecksum,
          combinedAt: new Date().toISOString(),
          sessionId
        }
      })

    if (uploadError) {
      throw new Error(`Failed to upload combined file: ${uploadError.message}`)
    }

    // Cleanup chunks
    const chunkPaths = Array.from({ length: totalChunks }, (_, i) => `${fileName}.chunk.${i}`)
    await supabase.storage
      .from('health-files')
      .remove(chunkPaths)

    console.log(`Combined file uploaded to: ${finalPath}`)

    return new Response(
      JSON.stringify({
        success: true,
        filePath: finalPath,
        fileSize: totalSize,
        checksum: actualChecksum
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Combine chunks error:', error)
    
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

async function calculateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}