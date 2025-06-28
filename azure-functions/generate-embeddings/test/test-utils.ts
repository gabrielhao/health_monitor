// Test utilities - exported functions from index.ts for testing
import { CosmosClient, Container } from "@azure/cosmos";
import { XMLParser } from "fast-xml-parser";
import { AzureKeyCredential, OpenAIClient } from "@azure/openai";
import { InvocationContext } from "@azure/functions";

// Constants (exported for testing)
export const EMBEDDING_MODEL = "text-embedding-ada-002" as const;
export const MAX_TEXT_LENGTH = 8000 as const;
export const MAX_CHUNK_SIZE = 35 as const;
export const BATCH_SIZE = 3 as const;
export const DATABASE_NAME = "health-monitor-db" as const;
export const CONTAINER_NAME = "health-embeddings" as const;

// Types (exported for testing)
export interface AppleHealthRecord {
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

export interface EmbeddingDocument {
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

// Exported utility functions for testing
export function validateEnvironment(): void {
  const required = [
    'CosmosDbConnectionString',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// AzureServices class (exported for testing)
export class AzureServices {
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

  // Reset for testing
  static resetContainer(): void {
    this._cosmosContainer = null;
  }
}

// EmbeddingService class (exported for testing)
export class EmbeddingService {
  static async generateEmbedding(text: string): Promise<number[]> {
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

  static calculateOptimalChunkSize(records: AppleHealthRecord[]): number {
    if (records.length === 0) return MAX_CHUNK_SIZE;

    const sampleSize = Math.min(10, records.length);
    const sample = records.slice(0, sampleSize);
    
    const avgLength = sample.reduce((sum, record) => {
      const formatted = AppleHealthXMLProcessor.formatRecord(record);
      return sum + formatted.length;
    }, 0) / sampleSize;

    const safeTokenLimit = 7000;
    const avgTokensPerRecord = Math.ceil(avgLength / 4);
    const optimalSize = Math.floor(safeTokenLimit / avgTokensPerRecord);

    return Math.min(Math.max(optimalSize, 10), MAX_CHUNK_SIZE);
  }
}

// AppleHealthXMLProcessor class (exported for testing)
export class AppleHealthXMLProcessor {
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

  static formatRecord(record: AppleHealthRecord): string {
    const type = this.formatHealthType(record['@_type']);
    const value = record['@_value'];
    const unit = record['@_unit'] || '';
    const startDate = record['@_startDate'];
    const endDate = record['@_endDate'] || startDate;
    const sourceName = record['@_sourceName'] || 'Unknown Source';
    const device = record['@_device'] || 'Unknown Device';
    
    return `${type}: ${value} ${unit} recorded from ${startDate} to ${endDate} via ${sourceName} on ${device}`;
  }

  static formatHealthType(type: string): string {
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

// ChunkingService class (exported for testing)
export class ChunkingService {
  static groupRecordsIntoChunks(records: AppleHealthRecord[]): AppleHealthRecord[][] {
    if (records.length === 0) return [];

    const optimalChunkSize = EmbeddingService.calculateOptimalChunkSize(records);
    const typeGroups = this.groupByType(records);
    const chunks: AppleHealthRecord[][] = [];

    for (const [type, typeRecords] of Object.entries(typeGroups)) {
      const sortedRecords = typeRecords.sort((a, b) => 
        new Date(a['@_startDate']).getTime() - new Date(b['@_startDate']).getTime()
      );

      for (let i = 0; i < sortedRecords.length; i += optimalChunkSize) {
        chunks.push(sortedRecords.slice(i, i + optimalChunkSize));
      }
    }

    return chunks;
  }

  static groupByType(records: AppleHealthRecord[]): Record<string, AppleHealthRecord[]> {
    const groups: Record<string, AppleHealthRecord[]> = {};

    for (const record of records) {
      const type = record['@_type'] || 'unknown';
      groups[type] = groups[type] || [];
      groups[type].push(record);
    }

    return groups;
  }
}

// DocumentService class (exported for testing)
export class DocumentService {
  static createEmbeddingDocument(
    chunk: AppleHealthRecord[],
    chunkIndex: number,
    documentId: string,
    userId: string,
    embedding: number[]
  ): EmbeddingDocument {
    const contentChunk = chunk.map(AppleHealthXMLProcessor.formatRecord).join('\n');
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

// Processing functions (exported for testing)
export async function processChunk(
  chunk: AppleHealthRecord[],
  chunkIndex: number,
  documentId: string,
  userId: string,
  context: InvocationContext
): Promise<void> {
  try {
    const contentChunk = chunk.map(AppleHealthXMLProcessor.formatRecord).join('\n');
    const embedding = await EmbeddingService.generateEmbedding(contentChunk);
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

export async function processChunksInBatches(
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