import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import OpenAI from 'openai';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

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
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  
  try {
    const result = parser.parse(xmlString);
    return result;
  } catch (error) {
    console.error('Error parsing XML:', error);
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
  
  return `${formattedType}: "${value}" ${unit} recorded start at ${startDate} end at ${endDate} from source "${sourceName}"`;
}

/**
 * Generate embeddings for the given text using OpenAI's API
 * @param text - The text to generate embeddings for
 * @returns Array of embedding values
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Store health data with embeddings in Supabase
 * @param data - The health data to store
 * @returns The stored record
 */
export async function storeHealthData(data: HealthData): Promise<HealthData> {
  try {
    const { data: result, error } = await supabase
      .from('health_embeddings')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error('Error storing health data:', error);
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
  try {
    const parsedXML = await processXML(xmlString);
    
    const content = parsedXML.Record.map((record: AppleHealthRecord) => {
      return formatRecordToString(record);
    }).join('\n');
    
    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Store in database
    const healthData: HealthData = {
      user_id: userId,
      document_id: documentId,
      content_chunk: content,
      embedding,
      chunk_index: 0, // Since we're storing the whole XML as one chunk
      metadata: {
        ...metadata,
        originalFormat: 'xml',
        contentLength: content.length,
      },
    };
    
    return await storeHealthData(healthData);
  } catch (error) {
    console.error('Error in processAndStoreXML:', error);
    throw error;
  }
} 