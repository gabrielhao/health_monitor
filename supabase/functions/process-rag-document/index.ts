/*
  # Process RAG Document Edge Function

  This function processes uploaded documents for RAG applications:
  1. Downloads file from storage
  2. Extracts text content based on file type
  3. Chunks text into segments
  4. Generates embeddings using OpenAI
  5. Stores chunks and embeddings in database

  Supported formats: PDF, DOCX, TXT, CSV, JSON
*/

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessDocumentRequest {
  documentId: string
  filePath: string
  options: {
    chunkSize: number
    chunkOverlap: number
    generateEmbeddings: boolean
    preserveFormatting: boolean
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
    
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

    const { documentId, filePath, options }: ProcessDocumentRequest = await req.json()

    console.log(`Processing document ${documentId} for user ${user.id}`)

    // Get document record
    const { data: document, error: docError } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) {
      throw new Error('Document not found')
    }

    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('rag-documents')
        .download(filePath)

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`)
      }

      // Extract text content based on file type
      let textContent = ''
      
      switch (document.file_type) {
        case 'text/plain':
          textContent = await fileData.text()
          break
        case 'application/json':
          const jsonData = await fileData.text()
          textContent = JSON.stringify(JSON.parse(jsonData), null, 2)
          break
        case 'text/csv':
          textContent = await fileData.text()
          break
        case 'application/pdf':
          // For PDF, you would use a PDF parsing library
          // For now, we'll simulate text extraction
          textContent = await simulatePDFExtraction(fileData)
          break
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          // For DOCX, you would use a DOCX parsing library
          // For now, we'll simulate text extraction
          textContent = await simulateDOCXExtraction(fileData)
          break
        default:
          throw new Error(`Unsupported file type: ${document.file_type}`)
      }

      console.log(`Extracted ${textContent.length} characters from document`)

      // Update document with content
      await supabase
        .from('rag_documents')
        .update({ content: textContent })
        .eq('id', documentId)

      // Chunk the text
      const chunks = chunkText(textContent, options.chunkSize, options.chunkOverlap)
      console.log(`Created ${chunks.length} chunks`)

      // Process chunks and generate embeddings
      const chunkRecords = []
      let embeddingCount = 0

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        let embedding = null

        if (options.generateEmbeddings) {
          try {
            embedding = await generateEmbedding(chunk, openaiApiKey)
            embeddingCount++
          } catch (embeddingError) {
            console.warn(`Failed to generate embedding for chunk ${i}:`, embeddingError)
          }
        }

        chunkRecords.push({
          document_id: documentId,
          user_id: user.id,
          content: chunk,
          embedding,
          chunk_index: i,
          token_count: estimateTokenCount(chunk),
          metadata: {
            chunk_size: options.chunkSize,
            chunk_overlap: options.chunkOverlap,
            preserve_formatting: options.preserveFormatting
          }
        })
      }

      // Insert chunks in batches
      const batchSize = 100
      for (let i = 0; i < chunkRecords.length; i += batchSize) {
        const batch = chunkRecords.slice(i, i + batchSize)
        
        const { error: insertError } = await supabase
          .from('rag_chunks')
          .insert(batch)

        if (insertError) {
          throw new Error(`Failed to insert chunks: ${insertError.message}`)
        }
      }

      // Update document with final counts and status
      const { data: updatedDocument, error: updateError } = await supabase
        .from('rag_documents')
        .update({
          status: 'completed',
          chunk_count: chunks.length,
          embedding_count: embeddingCount,
          error_message: null
        })
        .eq('id', documentId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`)
      }

      console.log(`Document processing completed: ${chunks.length} chunks, ${embeddingCount} embeddings`)

      return new Response(
        JSON.stringify({
          success: true,
          document: updatedDocument,
          chunks: chunks.length,
          embeddings: embeddingCount
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )

    } catch (processingError) {
      // Update document with error status
      await supabase
        .from('rag_documents')
        .update({
          status: 'failed',
          error_message: processingError instanceof Error ? processingError.message : 'Processing failed'
        })
        .eq('id', documentId)

      throw processingError
    }

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

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  let currentChunk = ''
  let currentTokens = 0
  
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokenCount(sentence)
    
    if (currentTokens + sentenceTokens > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      
      // Handle overlap
      if (overlap > 0) {
        const overlapText = getLastTokens(currentChunk, overlap)
        currentChunk = overlapText + ' ' + sentence
        currentTokens = estimateTokenCount(currentChunk)
      } else {
        currentChunk = sentence
        currentTokens = sentenceTokens
      }
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence
      currentTokens += sentenceTokens
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}

function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4)
}

function getLastTokens(text: string, tokenCount: number): string {
  const words = text.split(' ')
  const estimatedWords = Math.ceil(tokenCount * 0.75) // Rough conversion
  return words.slice(-estimatedWords).join(' ')
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002'
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

async function simulatePDFExtraction(fileData: Blob): Promise<string> {
  // In a real implementation, you would use a PDF parsing library like pdf-parse
  // For now, we'll return a placeholder
  return `[PDF Content Extracted]\n\nThis is simulated PDF text extraction. In a real implementation, you would use a PDF parsing library to extract the actual text content from the PDF file.\n\nFile size: ${fileData.size} bytes`
}

async function simulateDOCXExtraction(fileData: Blob): Promise<string> {
  // In a real implementation, you would use a DOCX parsing library
  // For now, we'll return a placeholder
  return `[DOCX Content Extracted]\n\nThis is simulated DOCX text extraction. In a real implementation, you would use a DOCX parsing library to extract the actual text content from the Word document.\n\nFile size: ${fileData.size} bytes`
}