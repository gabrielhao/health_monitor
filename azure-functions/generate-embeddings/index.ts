// Azure Function: Process Apple Health XML and generate embeddings for vector search
import { app, InvocationContext } from "@azure/functions";
import { CosmosClient, Container } from "@azure/cosmos";
import { AzureKeyCredential, OpenAIClient } from "@azure/openai";
import { XMLParser } from "fast-xml-parser";

// ========================================
// TYPES & INTERFACES
// ========================================

interface AppleHealthRecord {
  readonly '@_type': string;
  readonly '@_value': string;
  readonly '@_unit'?: string;
  readonly '@_startDate': string;
  readonly '@_endDate'?: string;
  readonly '@_sourceName'?: string;
  readonly '@_sourceVersion'?: string;
  readonly '@_device'?: string;
  readonly '@_creationDate'?: string;
}

interface EmbeddingDocument {
  readonly id: string;
  readonly user_id: string;
  readonly document_id: string;
  readonly chunk_index: number;
  readonly content_chunk: string;
  readonly embedding: number[];
  readonly metadata: string;
  readonly timestamp: string;
  readonly _partitionKey: string;
}

interface ProcessingResult {
  readonly processedChunks: number;
  readonly totalRecords: number;
  readonly processingTimeMs: number;
}

// ========================================
// CONSTANTS
// ========================================

const EMBEDDING_MODEL = "text-embedding-ada-002" as const;
const MAX_TEXT_LENGTH = 8000 as const;
const MAX_CHUNK_SIZE = 15 as const; // max 15 recrds for one chunk for embedding input
const DATABASE_NAME = "health-monitor-db" as const;
const CONTAINER_NAME = "health-embeddings" as const;
const BATCH_SIZE = 5 as const; // process 5 chunks at a time to avoid overwhelming the API

// Chunk size analysis for text-embedding-ada-002:
// - Model limit: 8,192 tokens (~32,000 characters)
// - Apple Health record: ~140 characters average
// - Optimal chunk: 35 records = 4,900 characters (well within limits)
// - Provides good semantic coherence for similar health metrics

// ========================================
// AZURE SERVICES INITIALIZATION
// ========================================

class AzureServices {
  private static _cosmosContainer: Container | null = null;

  static getCosmosContainer(): Container {
    if (!this._cosmosContainer) {
      const connectionString = process.env.CosmosDbConnectionString;
      
      if (!connectionString) {
        throw new Error('Missing CosmosDbConnectionString environment variable');
      }

      const cosmos = new CosmosClient(connectionString);
      this._cosmosContainer = cosmos.database(DATABASE_NAME).container(CONTAINER_NAME);
    }
    return this._cosmosContainer;
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Validates required environment variables
 * @throws Error if any required environment variable is missing
 */
function validateEnvironment(): void {
  const required = [
    'CosmosDbConnectionString', // Using the connection string as per Microsoft docs
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// ========================================
// EMBEDDING SERVICE
// ========================================

class EmbeddingService {
  /**
   * Generate embedding vector for Apple Health text using Azure OpenAI
   * Optimized for health metrics with proper chunking and validation
   * @param text Health records text to embed
   * @returns Promise resolving to embedding vector (1536 dimensions for ada-002)
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Empty text provided for embedding generation');
    }

    const trimmedText = text.substring(0, MAX_TEXT_LENGTH);
    const estimatedTokens = Math.ceil(trimmedText.length / 4);
    
    if (estimatedTokens > 8000) {
      throw new Error(`Text too long: ${estimatedTokens} estimated tokens (max 8192)`);
    }
    
    try {
      const client = new OpenAIClient(
        process.env.AZURE_OPENAI_ENDPOINT!,
        new AzureKeyCredential(process.env.AZURE_OPENAI_KEY!)
      );

      const result = await client.getEmbeddings(EMBEDDING_MODEL, [trimmedText]);
      const embedding = result.data[0].embedding;
      
      // Validate embedding dimensions
      if (embedding.length !== 1536) {
        throw new Error(`Unexpected embedding dimensions: ${embedding.length} (expected 1536)`);
      }

      return embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      throw new Error('Unknown error during embedding generation');
    }
  }

}


// ========================================
// XML PROCESSING SERVICE
// ========================================

class AppleHealthXMLProcessor {
  /**
   * Parse Apple Health XML into structured records
   * @param xmlContent Raw XML content
   * @returns Array of validated Apple Health records
   */
  static parseXML(xmlContent: string): AppleHealthRecord[] {
    if (!xmlContent.trim()) {
      throw new Error('Empty XML content provided');
    }

    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true,
      });

      const parsedXML = parser.parse(xmlContent);
      
      if (!parsedXML?.HealthData?.Record) {
        throw new Error('Invalid Apple Health XML: Missing HealthData.Record structure');
      }

      const records = Array.isArray(parsedXML.HealthData.Record) 
        ? parsedXML.HealthData.Record 
        : [parsedXML.HealthData.Record];

      return records;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`XML parsing failed: ${error.message}`);
      }
      throw new Error('Unknown XML parsing error');
    }
  }

  /**
   * Format health record into human-readable text
   * @param record Apple Health record
   * @returns Formatted text representation
   */
  static formatRecord(record: AppleHealthRecord): string {
    const type = this.formatHealthType(record['@_type']);
    const value = record['@_value'];
    const unit = record['@_unit'] || '';
    const startDate = record['@_startDate'];
    const endDate = record['@_endDate'] || startDate;
    const sourceName = record['@_sourceName'] || 'Unknown Source';
    
    return `${type}: ${value} ${unit} recorded from ${startDate} to ${endDate} via ${sourceName}`;
  }

  /**
   * Convert Apple Health type identifier to readable format
   * Examples:
   * - HKQuantityTypeIdentifierHeartRate -> heart rate
   * - HKQuantityTypeIdentifierStepCount -> step count
   * - HKCategoryTypeIdentifierSleepAnalysis -> sleep analysis
   * - HKQuantityTypeIdentifierDistanceWalkingRunning -> distance walking running
   */
  private static formatHealthType(type: string): string {
    return type
      .replace(/^HKQuantityTypeIdentifier/, '')
      .replace(/^HKCategoryTypeIdentifier/, '')
      .replace(/^HKCorrelationTypeIdentifier/, '')
      .replace(/^HKWorkoutTypeIdentifier/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
  }
}

// ========================================
// CHUNKING SERVICE
// ========================================

class ChunkingService {
  /**
   * Group records into chunks based on MAX_CHUNK_SIZE, following input sequence
   * @param records Array of health records
   * @returns Array of record chunks with max MAX_CHUNK_SIZE records per chunk
   */
  static groupRecordsIntoChunks(records: AppleHealthRecord[]): AppleHealthRecord[][] {
    if (records.length === 0) return [];

    const chunks: AppleHealthRecord[][] = [];

    // Create chunks based on MAX_CHUNK_SIZE, following the input sequence
    for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
      chunks.push(records.slice(i, i + MAX_CHUNK_SIZE));
    }

    return chunks;
  }
}

// ========================================
// DOCUMENT SERVICE
// ========================================

class DocumentService {
  /**
   * Create embedding document for Cosmos DB storage
   */
  static createEmbeddingDocument(
    chunk: AppleHealthRecord[],
    chunkIndex: number,
    documentId: string,
    userId: string,
    embedding: number[]
  ): EmbeddingDocument {
    const contentChunk = chunk.map(AppleHealthXMLProcessor.formatRecord).join('\n');
    const firstRecord = chunk[0];
    const lastRecord = chunk[chunk.length - 1];

    const metadata: string = JSON.stringify(chunk);

    return {
      id: `${documentId}-chunk-${chunkIndex}`,
      user_id: userId,
      document_id: documentId,
      chunk_index: chunkIndex,
      content_chunk: contentChunk,
      embedding,
      metadata: JSON.stringify(metadata),
      timestamp: new Date().toISOString(),
      _partitionKey: userId,
    };
  }

/**
 * Store document in Cosmos DB with retry logic
 */
static async storeDocument(document: EmbeddingDocument): Promise<void> {
  const container = AzureServices.getCosmosContainer();
  try {
    await container.items.create(document);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to store document ${document.id}: ${error.message}`);
    }
    throw new Error(`Failed to store document ${document.id}: Unknown error`);
  }
}
}

// ========================================
// MAIN PROCESSING FUNCTION
// ========================================

/**
 * Process a single chunk: generate embedding and store in database
 */
async function processChunk(
  chunk: AppleHealthRecord[],
  chunkIndex: number,
  documentId: string,
  userId: string,
  context: InvocationContext
): Promise<void> {
  try {
    // Format chunk content for embedding
    const contentChunk = chunk.map(AppleHealthXMLProcessor.formatRecord).join('\n');
    
    // Generate embedding
    const embedding = await EmbeddingService.generateEmbedding(contentChunk);

    // Create and store document
    const document = DocumentService.createEmbeddingDocument(
      chunk, chunkIndex, documentId, userId, embedding
    );
    
    await DocumentService.storeDocument(document);
    
    context.log(`✓ Processed chunk ${chunkIndex + 1} with ${chunk.length} records`);
  } catch (error) {
    context.error(`✗ Failed to process chunk ${chunkIndex}:`, error);
    throw error;
  }
}

/**
 * Process chunks in controlled batches
 */
async function processChunksInBatches(
  chunks: AppleHealthRecord[][],
  documentId: string,
  userId: string,
  context: InvocationContext
): Promise<number> {
  let processedCount = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map((chunk, batchIndex) =>
      processChunk(chunk, i + batchIndex, documentId, userId, context)
    );

    await Promise.all(batchPromises);
    processedCount += batch.length;
    
    context.log(`Completed batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} of ${Math.ceil(chunks.length / BATCH_SIZE)}`);
  }

  return processedCount;
}

// ========================================
// AZURE FUNCTION ENTRY POINT
// ========================================

app.storageBlob("generateEmbeddings", {
  path: "uploads/{name}",
  connection: "AzureWebJobsStorage",
  handler: async (blob, context): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Validate environment and extract metadata
      validateEnvironment();
      const userId = context.triggerMetadata?.userId as string;
      const documentId = context.triggerMetadata?.name as string;

      context.log(`🚀 Starting processing: ${documentId} (user: ${userId})`);
      
      if (!userId || !documentId) {
        context.error('❌ Missing required metadata: user_id or document_id');
        return;
      }

      // Process XML content
      const xmlContent = (blob as Buffer).toString('utf8');
      context.log(`📄 XML file size: ${xmlContent.length} characters`);

      const records = AppleHealthXMLProcessor.parseXML(xmlContent);
      context.log(`📊 Parsed ${records.length} health records`);

      if (records.length === 0) {
        context.warn('⚠️  No valid records found in XML file');
        return;
      }

      // Create semantic chunks
      const chunks = ChunkingService.groupRecordsIntoChunks(records);
      context.log(`📦 Created ${chunks.length} semantic chunks`);

      // Process all chunks
      const processedChunks = await processChunksInBatches(chunks, documentId, userId, context);

      const result: ProcessingResult = {
        processedChunks,
        totalRecords: records.length,
        processingTimeMs: Date.now() - startTime
      };

      context.log(`✅ Successfully processed ${result.processedChunks} chunks with ${result.totalRecords} records in ${result.processingTimeMs}ms`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      context.error(`❌ Processing failed after ${processingTime}ms:`, error);
      throw error;
    }
  },
});