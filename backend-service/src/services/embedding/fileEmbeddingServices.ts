import { AzureOpenAI } from "openai";
import { 
    DefaultAzureCredential, 
    getBearerTokenProvider 
  } from "@azure/identity";
import { XMLParser } from "fast-xml-parser";
import { azureBlobService } from '../../shared/services/azureBlobService.js';
import { azureCosmosService } from '../../shared/services/azureCosmosService.js';
import type { 
  AppleHealthRecord, 
  EmbeddingDocument, 
  EmbeddingProcessingResult, 
  EmbeddingJob,
  EmbeddingProcessingOptions,
  RAGDocument
} from '../../shared/types/index.js';

// ========================================
// CONSTANTS
// ========================================

const EMBEDDING_MODEL = "text-embedding-ada-002" as const;
const MAX_TEXT_LENGTH = 8000 as const;
const MAX_CHUNK_SIZE = 15 as const; // max 15 records for one chunk for embedding input
const BATCH_SIZE = 5 as const; // process 5 chunks at a time to avoid overwhelming the API

// ========================================
// MAIN EMBEDDING SERVICE
// ========================================

export class EmbeddingService {
  private processingJobs: Map<string, EmbeddingJob> = new Map();
  private openAIClient: AzureOpenAI | null = null;

  async initialize(): Promise<void> {
    await azureBlobService.initialize();
    await azureCosmosService.initialize();
    this.validateEnvironment();
    this.initializeOpenAIClient();
    console.log('Embedding Service initialized successfully');
  }

  /**
   * Process a RAG document and generate embeddings for it
   */
  async processDocumentEmbeddings(
    ragDocumentId: string, 
    userId: string, 
    options: EmbeddingProcessingOptions = {}
  ): Promise<EmbeddingProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting embedding processing rag document: ${ragDocumentId} (user: ${userId})`);
      
      // Get RAG document from Cosmos DB
      const ragDocument = await azureCosmosService.getRAGDocument(ragDocumentId, userId);
      if (!ragDocument) {
        throw new Error(`RAG document not found: ${ragDocumentId}`);
      }

      if (!ragDocument.documentFilePath) {
        throw new Error(`RAG document has no file path: ${ragDocumentId}`);
      }

      // Download and process XML content
      const fileBuffer = await azureBlobService.downloadFile(ragDocument.documentFilePath);
      const xmlContent = fileBuffer.toString('utf8');
      console.log(`📄 XML file size: ${xmlContent.length} characters`);

      const records = this.parseXML(xmlContent);
      console.log(`📊 Parsed ${records.length} health records`);

      if (records.length === 0) {
        console.warn('⚠️  No valid records found in XML file');
        return {
          processedChunks: 0,
          totalRecords: 0,
          processingTimeMs: Date.now() - startTime,
          documentId: ragDocumentId,
          userId
        };
      }

      // Create semantic chunks
      const chunks = this.groupRecordsIntoChunks(records, options.maxChunkSize);
      console.log(`📦 Created ${chunks.length} semantic chunks`);

      // Process all chunks
      const processedChunks = await this.processChunksInBatches(
        chunks, 
        ragDocumentId, 
        userId, 
        options.batchSize || BATCH_SIZE
      );

      const result: EmbeddingProcessingResult = {
        processedChunks,
        totalRecords: records.length,
        processingTimeMs: Date.now() - startTime,
        documentId: ragDocumentId,
        userId
      };

      console.log(`✅ Successfully processed ${result.processedChunks} chunks with ${result.totalRecords} records in ${result.processingTimeMs}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Processing failed after ${processingTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Generate embedding vector for Apple Health text using Azure OpenAI
   */
  async generateEmbedding(text: string, options: EmbeddingProcessingOptions = {}): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Empty text provided for embedding generation');
    }

    const maxLength = options.maxTextLength || MAX_TEXT_LENGTH;
    const trimmedText = text.substring(0, maxLength);
    const estimatedTokens = Math.ceil(trimmedText.length / 4);
    
    if (estimatedTokens > 8000) {
      throw new Error(`Text too long: ${estimatedTokens} estimated tokens (max 8192)`);
    }
    
    try {
      if (!this.openAIClient) {
        throw new Error('OpenAI client not initialized');
      }

      const result = await this.openAIClient.embeddings.create({
        model: EMBEDDING_MODEL,
        input: trimmedText,
      });
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

  /**
   * Get embedding documents for a user and/or document
   */
  async getEmbeddingDocuments(
    userId: string, 
    documentId?: string, 
    limit?: number
  ): Promise<EmbeddingDocument[]> {
    return await azureCosmosService.getEmbeddingDocuments(userId, { documentId, limit });
  }

  /**
   * Delete embedding documents
   */
  async deleteEmbeddingDocuments(userId: string, documentId?: string): Promise<void> {
    await azureCosmosService.deleteEmbeddingDocuments(userId, documentId);
  }

  /**
   * Get count of embedding documents
   */
  async getEmbeddingDocumentsCount(userId: string, documentId?: string): Promise<number> {
    return await azureCosmosService.getEmbeddingDocumentsCount(userId, documentId);
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private validateEnvironment(): void {
    const required = [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  private initializeOpenAIClient(): void {
    if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_KEY) {
      throw new Error('Azure OpenAI credentials not found');
    }

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-ada-002';
    const apiKey = process.env.AZURE_OPENAI_KEY;

    // const credential = new DefaultAzureCredential();
    // const scope = "https://cognitiveservices.azure.com/.default";
    // const azureADTokenProvider = getBearerTokenProvider(credential, scope);

    this.openAIClient = new AzureOpenAI({
        endpoint,
        apiKey,
        apiVersion: '2023-05-15',
        deployment: deploymentName,
      });
  }

  private parseXML(xmlContent: string): AppleHealthRecord[] {
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

  private formatRecord(record: AppleHealthRecord): string {
    const type = this.formatHealthType(record['@_type']);
    const value = record['@_value'];
    const unit = record['@_unit'] || '';
    const startDate = record['@_startDate'];
    const endDate = record['@_endDate'] || startDate;
    const sourceName = record['@_sourceName'] || 'Unknown Source';
    
    return `${type}: ${value} ${unit} recorded from ${startDate} to ${endDate} from ${sourceName}`;
  }

  private formatHealthType(type: string): string {
    return type
      .replace(/^HKQuantityTypeIdentifier/, '')
      .replace(/^HKCategoryTypeIdentifier/, '')
      .replace(/^HKCorrelationTypeIdentifier/, '')
      .replace(/^HKWorkoutTypeIdentifier/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
  }

  private groupRecordsIntoChunks(
    records: AppleHealthRecord[], 
    maxChunkSize?: number
  ): AppleHealthRecord[][] {
    if (records.length === 0) return [];

    const chunkSize = maxChunkSize || MAX_CHUNK_SIZE;
    const chunks: AppleHealthRecord[][] = [];

    for (let i = 0; i < records.length; i += chunkSize) {
      chunks.push(records.slice(i, i + chunkSize));
    }

    return chunks;
  }

  private createEmbeddingDocument(
    chunk: AppleHealthRecord[],
    chunkIndex: number,
    documentId: string,
    userId: string,
    embedding: number[]
  ): EmbeddingDocument {
    const contentChunk = chunk.map(record => this.formatRecord(record)).join('\n');
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

  private async processChunk(
    chunk: AppleHealthRecord[],
    chunkIndex: number,
    documentId: string,
    userId: string
  ): Promise<void> {
    try {
      // Format chunk content for embedding
      const contentChunk = chunk.map(record => this.formatRecord(record)).join('\n');
      
      // Generate embedding
      const embedding = await this.generateEmbedding(contentChunk);

      // Create and store document
      const document = this.createEmbeddingDocument(
        chunk, chunkIndex, documentId, userId, embedding
      );
      
      await azureCosmosService.createEmbeddingDocument(document);
      
      console.log(`✓ Processed chunk ${chunkIndex + 1} with ${chunk.length} records`);
    } catch (error) {
      console.error(`✗ Failed to process chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  private async processChunksInBatches(
    chunks: AppleHealthRecord[][],
    documentId: string,
    userId: string,
    batchSize: number
  ): Promise<number> {
    let processedCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const batchPromises = batch.map((chunk, batchIndex) =>
        this.processChunk(chunk, i + batchIndex, documentId, userId)
      );

      await Promise.all(batchPromises);
      processedCount += batch.length;
      
      console.log(`Completed batch ${Math.ceil((i + batchSize) / batchSize)} of ${Math.ceil(chunks.length / batchSize)}`);
    }

    return processedCount;
  }
}

export const embeddingService = new EmbeddingService();
