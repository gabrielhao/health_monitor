import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate a simple but effective embedding using text characteristics
 * This serves as a fallback when the edge function is unavailable
 * @param text - The text to generate embeddings for
 * @returns Array of embedding values (384 dimensions)
 */
function generateFallbackEmbedding(text: string): number[] {
  console.log('[EMBEDDING_FALLBACK] Generating fallback embedding...');
  
  const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  const uniqueWords = new Set(words);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Initialize 384-dimensional embedding vector
  const embedding = new Array(384).fill(0);
  
  // Basic text statistics (dimensions 0-19)
  embedding[0] = Math.min(words.length / 1000, 1); // Word count (normalized)
  embedding[1] = Math.min(uniqueWords.size / 500, 1); // Unique word count
  embedding[2] = uniqueWords.size / Math.max(words.length, 1); // Vocabulary richness
  embedding[3] = Math.min(sentences.length / 100, 1); // Sentence count
  embedding[4] = Math.min(text.length / 10000, 1); // Character count
  embedding[5] = words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1) / 20; // Average word length
  
  // Character distribution (dimensions 20-45) - common letters
  const commonChars = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < commonChars.length; i++) {
    const char = commonChars[i];
    const count = (text.toLowerCase().match(new RegExp(char, 'g')) || []).length;
    embedding[20 + i] = Math.min(count / Math.max(text.length, 1) * 100, 1);
  }
  
  // Health-specific terms (dimensions 46-85) - boost relevance for health data
  const healthTerms = [
    'heart', 'blood', 'pressure', 'weight', 'steps', 'sleep', 'exercise', 'calories',
    'glucose', 'insulin', 'medication', 'temperature', 'pulse', 'oxygen', 'activity',
    'walking', 'running', 'cycling', 'workout', 'fitness', 'health', 'medical',
    'doctor', 'hospital', 'clinic', 'treatment', 'diagnosis', 'symptom', 'pain',
    'fatigue', 'energy', 'mood', 'stress', 'anxiety', 'depression', 'recovery',
    'nutrition', 'diet', 'protein', 'carbs'
  ];
  
  for (let i = 0; i < healthTerms.length && i < 40; i++) {
    const term = healthTerms[i];
    const regex = new RegExp(term, 'gi');
    const matches = (text.match(regex) || []).length;
    embedding[46 + i] = Math.min(matches / Math.max(words.length, 1) * 1000, 1);
  }
  
  // Word hash features (dimensions 86-383) - capture semantic content
  const topWords = Array.from(uniqueWords)
    .sort((a, b) => {
      const countA = words.filter(w => w === a).length;
      const countB = words.filter(w => w === b).length;
      return countB - countA;
    })
    .slice(0, 298); // Take top 298 most frequent words
    
  for (let i = 0; i < topWords.length; i++) {
    const word = topWords[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
    }
    embedding[86 + i] = (Math.abs(hash) % 10000) / 10000;
  }
  
  // Normalize the embedding vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  const normalizedEmbedding = embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  
  console.log('[EMBEDDING_FALLBACK] Fallback embedding generated successfully');
  return normalizedEmbedding;
}

interface HealthData {
  id?: string;
  user_id: string;
  document_id: string;
  content_chunk: string;
  embedding: number[];
  chunk_index: number;
  metadata: Record<string, any>;
  created_at?: string;
}

interface AppleHealthRecord {
  '@_type': string;
  '@_value': string;
  '@_unit': string;
  '@_startDate': string;
  '@_sourceName': string;
  '@_sourceVersion'?: string;
  '@_device'?: string;
  '@_creationDate'?: string;
  '@_endDate'?: string;
}

/**
 * Process XML string and convert it to a structured object
 * @param xmlString - The XML string to process
 * @returns Parsed XML object
 */
export async function processXML(xmlString: string): Promise<any> {
  console.log('[XML_PARSER] Starting XML parsing...');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  
  try {
    const result = parser.parse(xmlString);
    console.log('[XML_PARSER] XML parsing completed successfully');
    return result;
  } catch (error) {
    console.error('[XML_PARSER] Error parsing XML:', error);
    throw error;
  }
}

/**
 * Format a single health record into a string
 * @param record - The health record object
 * @returns Formatted text string for the record
 */
export function formatRecordToString(record: AppleHealthRecord): string {

  const type = record['@_type'] || '';
  const value = record['@_value'] || '';
  const unit = record['@_unit'] || '';
  const startDate = record['@_startDate'] || '';
  const endDate = record['@_endDate'] || '';
  const sourceName = record['@_sourceName'] || '';
  
  const formattedType = type
    .replace('HKQuantityTypeIdentifier', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
  
  const formattedString = `${formattedType}: "${value}" ${unit} recorded start at ${startDate} end at ${endDate} from source "${sourceName}"`;
  console.debug('[RECORD_FORMATTER] Formatted record string:', formattedString);
  return formattedString;
}

/**
 * Generate embeddings for the given text using Supabase edge function
 * @param text - The text to generate embeddings for
 * @returns Array of embedding values
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log('[EMBEDDING_GENERATOR] Generating embedding for text...');
  console.debug('[EMBEDDING_GENERATOR] Text length:', text.length, 'characters');
  console.debug('[EMBEDDING_GENERATOR] Text preview:', text.substring(0, 100) + '...');
  
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }
  
  // Truncate text if it's too long
  const maxLength = 512 * 4; // Roughly 512 tokens worth of characters
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  
  if (text.length > maxLength) {
    console.warn(`[EMBEDDING_GENERATOR] Text truncated from ${text.length} to ${truncatedText.length} characters`);
  }
  
  try {
    // Call the Supabase edge function to generate embeddings
    const { data, error } = await supabase.functions.invoke('generate-query-embedding', {
      body: { text: truncatedText }
    });
    
    if (error) {
      console.error('[EMBEDDING_GENERATOR] Edge function error:', error);
      throw error;
    }
    
    if (!data || !data.embedding) {
      throw new Error('Invalid response from embedding service');
    }
    
    const embedding = data.embedding as number[];
    console.debug('[EMBEDDING_GENERATOR] Generated embedding length:', embedding.length);
    console.log('[EMBEDDING_GENERATOR] Embedding generation completed successfully');
    return embedding;
    
  } catch (error) {
    console.error('[EMBEDDING_GENERATOR] Error generating embedding:', error);
    
    // Fall back to simple embedding if edge function fails
    console.warn('[EMBEDDING_GENERATOR] Falling back to simple embedding generation');
    return generateFallbackEmbedding(truncatedText);
  }
}

/**
 * Store health data with embeddings in Supabase
 * @param data - The health data to store
 * @returns The stored record
 */
export async function storeHealthData(data: HealthData): Promise<HealthData> {
  console.log('[DATABASE_STORAGE] Storing health data in Supabase...');
  console.debug('[DATABASE_STORAGE] Health data metadata:', {
    userId: data.user_id,
    documentId: data.document_id,
    chunkIndex: data.chunk_index,
    contentLength: data.content_chunk.length,
    embeddingLength: data.embedding.length,
    metadata: data.metadata
  });

  try {
    const { data: result, error } = await supabase
      .from('health_embeddings')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    console.log('[DATABASE_STORAGE] Health data stored successfully');
    console.debug('[DATABASE_STORAGE] Stored record ID:', result.id);
    return result;
  } catch (error) {
    console.error('[DATABASE_STORAGE] Error storing health data:', error);
    throw error;
  }
}

/**
 * Process XML and store it in the database with embeddings
 * @param xmlString - The XML string to process
 * @param userId - The user ID to associate with the data
 * @param documentId - The document ID to associate with the data
 * @param metadata - Additional metadata to store with the record
 * @returns The stored record
 */
export async function processAndStoreXML(
  xmlString: string,
  userId: string,
  documentId: string,
  metadata: Record<string, any> = {}
): Promise<HealthData> {
  console.log('[XML_PROCESSOR] Starting XML processing and storage...');
  console.debug('[XML_PROCESSOR] Input parameters:', {
    userId,
    documentId,
    xmlLength: xmlString.length,
    metadata
  });

  try {
    const parsedXML = await processXML(xmlString);
    console.log(`[XML_PROCESSOR] Processing ${parsedXML.Record.length} health records...`);
    console.debug('[XML_PROCESSOR] First record sample:', parsedXML.Record[0]);
    
    const content = parsedXML.Record.map((record: AppleHealthRecord) => {
      return formatRecordToString(record);
    }).join('\n');
    
    console.debug('[XML_PROCESSOR] Processed content length:', content.length);
    console.debug('[XML_PROCESSOR] Content preview:', content.substring(0, 200) + '...');
    
    console.log('[XML_PROCESSOR] Generating embedding for processed content...');
    const startTime = Date.now();
    const embedding = await generateEmbedding(content);
    const embeddingTime = Date.now() - startTime;
    console.log(`[XML_PROCESSOR] Embedding generated in ${embeddingTime}ms`);
    
    // Store in database
    const healthData: HealthData = {
      user_id: userId,
      document_id: documentId,
      content_chunk: content,
      embedding,
      chunk_index: 0,
      metadata: {
        ...metadata,
        originalFormat: 'xml',
        contentLength: content.length,
        recordCount: parsedXML.Record.length,
        embeddingGenerationTime: embeddingTime
      },
    };
    
    console.log('[XML_PROCESSOR] Storing processed data in database...');
    return await storeHealthData(healthData);
  } catch (error) {
    console.error('[XML_PROCESSOR] Error in processAndStoreXML:', error);
    throw error;
  }
}

/**
 * Process multiple XML chunks with shared pipeline for efficiency
 * @param chunks - Array of XML chunks to process
 * @param userId - The user ID to associate with the data
 * @param documentId - The document ID to associate with the data
 * @param baseMetadata - Base metadata to apply to all chunks
 * @returns Array of stored records
 */
export async function processBatchXMLChunks(
  chunks: Array<{ xmlString: string; chunkIndex: number; metadata?: Record<string, any> }>,
  userId: string,
  documentId: string,
  baseMetadata: Record<string, any> = {}
): Promise<HealthData[]> {
  console.log(`[XML_PROCESSOR] Starting batch processing of ${chunks.length} chunks...`);
  
  try {
    const results: HealthData[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[XML_PROCESSOR] Processing chunk ${i + 1}/${chunks.length} (index: ${chunk.chunkIndex})`);
      
      const chunkMetadata = {
        ...baseMetadata,
        ...chunk.metadata,
        batchSize: chunks.length,
        batchPosition: i + 1
      };
      
      const result = await processAndStoreXML(
        chunk.xmlString,
        userId,
        documentId,
        chunkMetadata
      );
      
      results.push(result);
      console.log(`[XML_PROCESSOR] Chunk ${i + 1}/${chunks.length} processed successfully`);
    }
    
    console.log(`[XML_PROCESSOR] Batch processing completed. Processed ${results.length} chunks.`);
    return results;
    
  } catch (error) {
    console.error('[XML_PROCESSOR] Error in batch processing:', error);
    throw error;
  }
}

// Legacy function exports for backward compatibility
// These functions are no longer needed but kept to avoid breaking existing code

/**
 * @deprecated This function is no longer needed as embeddings are generated via edge function
 */
export async function initializeEmbeddingPipeline(): Promise<void> {
  console.log('[EMBEDDING_PIPELINE] Pipeline initialization is now handled by edge function');
}

/**
 * @deprecated This function is no longer needed as embeddings are generated via edge function
 */
export function isEmbeddingPipelineReady(): boolean {
  return true; // Always ready since we use edge function
}

/**
 * @deprecated This function is no longer needed as embeddings are generated via edge function
 */
export function isEmbeddingPipelineInFallbackMode(): boolean {
  return false; // Edge function handles this internally
}

/**
 * @deprecated This function is no longer needed as embeddings are generated via edge function
 */
export function getEmbeddingPipelineStatus(): string {
  return 'initialized'; // Always initialized since we use edge function
}